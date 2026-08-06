package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
	"gorm.io/gorm"
)

var repoNameRe = regexp.MustCompile(`^[a-zA-Z0-9_\-\.]{1,255}$`)

// ── Request/Response ──────────────────────────────────────────────────────

type createRepoRequest struct {
	Name          string           `json:"name"`
	Description   string           `json:"description"`
	Visibility    models.Visibility `json:"visibility"`
	DefaultBranch string           `json:"default_branch"`
	IsTemplate    bool             `json:"is_template"`
}

type RepoPermissions struct {
	Admin bool `json:"admin"`
	Push  bool `json:"push"`
	Pull  bool `json:"pull"`
}

type repoResponse struct {
	models.Repository
	CloneURL    string          `json:"clone_url"`
	SSHURL      string          `json:"ssh_url"`
	Permissions RepoPermissions `json:"permissions"`
}

// ── Handlers ───────────────────────────────────────────────────────────────

// POST /api/v1/repos
func (h *Handler) CreateRepo(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var req createRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if !repoNameRe.MatchString(req.Name) {
		respondError(w, http.StatusUnprocessableEntity, "invalid_name",
			"Repository name must be 1–255 chars (letters, digits, -, _, .)")
		return
	}

	if req.Visibility == "" {
		req.Visibility = models.VisibilityPrivate
	}
	if req.DefaultBranch == "" {
		req.DefaultBranch = "main"
	}

	// Fetch owner
	var owner models.User
	if err := h.db.First(&owner, uid).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not load user")
		return
	}

	fullName := owner.Username + "/" + req.Name

	// Check for duplicate
	var existing models.Repository
	if err := h.db.Where("full_name = ?", fullName).First(&existing).Error; err == nil {
		respondError(w, http.StatusConflict, "already_exists",
			"Repository "+fullName+" already exists")
		return
	}

	// On-disk path
	storagePath := h.engine.RepoPath(owner.Username, req.Name)

	// Initialize .drag/ on disk
	if err := h.engine.InitRepo(storagePath); err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error",
			fmt.Sprintf("Could not initialize repository: %v", err))
		return
	}

	repo := models.Repository{
		OwnerID:       uid,
		Name:          req.Name,
		FullName:      fullName,
		Description:   req.Description,
		Visibility:    req.Visibility,
		DefaultBranch: req.DefaultBranch,
		StoragePath:   storagePath,
		IsTemplate:    req.IsTemplate,
	}

	if err := h.db.Create(&repo).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not save repository")
		return
	}

	// Add owner as member
	h.db.Create(&models.RepositoryMember{
		RepositoryID: repo.ID,
		UserID:       uid,
		Role:         models.RoleOwner,
	})

	respondJSON(w, http.StatusCreated, h.toRepoResponse(r, &repo))
}

// GET /api/v1/repos
func (h *Handler) ListRepos(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit := 20
	offset := (page - 1) * limit

	q := h.db.Preload("Owner").Order("created_at DESC").Limit(limit).Offset(offset)

	if uid == 0 {
		// Anonymous: only public repos
		q = q.Where("visibility = ?", models.VisibilityPublic)
	} else {
		// Authenticated: own repos + public repos + repos user is member of
		q = q.Where(`visibility = ? OR owner_id = ? OR id IN (
			SELECT repository_id FROM repository_members WHERE user_id = ?
		)`, models.VisibilityPublic, uid, uid)
	}

	var repos []models.Repository
	if err := q.Find(&repos).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not list repositories")
		return
	}

	var total int64
	h.db.Model(&models.Repository{}).Count(&total)

	type listResp struct {
		Items      []repoResponse `json:"items"`
		Page       int            `json:"page"`
		Limit      int            `json:"limit"`
		TotalCount int64          `json:"total_count"`
	}

	items := make([]repoResponse, len(repos))
	for i := range repos {
		items[i] = h.toRepoResponse(r, &repos[i])
	}

	respondJSON(w, http.StatusOK, listResp{
		Items:      items,
		Page:       page,
		Limit:      limit,
		TotalCount: total,
	})
}

// GET /api/v1/repos/{owner}/{repo}
func (h *Handler) GetRepo(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}
	respondJSON(w, http.StatusOK, h.toRepoResponse(r, repo))
}

// DELETE /api/v1/repos/{owner}/{repo}
func (h *Handler) DeleteRepo(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	// Only owner or admin can delete
	if repo.OwnerID != uid {
		var member models.RepositoryMember
		err := h.db.Where("repository_id = ? AND user_id = ? AND role IN ?",
			repo.ID, uid, []models.RepoRole{models.RoleOwner, models.RoleAdmin}).
			First(&member).Error
		if err != nil {
			respondError(w, http.StatusForbidden, "forbidden",
				"Only the owner or admin can delete a repository")
			return
		}
	}

	if err := h.db.Delete(repo).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not delete repository")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "repository deleted"})
}

// GET /api/v1/repos/{owner}/{repo}/commits
func (h *Handler) GetCommits(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	max, _ := strconv.Atoi(r.URL.Query().Get("max"))
	if max <= 0 {
		max = 30
	}

	commits, err := h.engine.Log(repo.StoragePath, max)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"commits": commits,
		"repo":    repo.FullName,
	})
}

// GET /api/v1/repos/{owner}/{repo}/branches
func (h *Handler) GetBranches(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	branches, err := h.engine.Branches(repo.StoragePath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"branches":       branches,
		"default_branch": repo.DefaultBranch,
	})
}

type createBranchRequest struct {
	Name   string `json:"name"`
	Target string `json:"target"`
}

// POST /api/v1/repos/{owner}/{repo}/branches
func (h *Handler) CreateBranch(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Write access required")
		return
	}

	var req createBranchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		respondError(w, http.StatusUnprocessableEntity, "invalid_name", "Branch name cannot be empty")
		return
	}

	if req.Target == "" {
		req.Target = repo.DefaultBranch
	}
	if req.Target == "" {
		req.Target = "main"
	}

	if err := h.engine.CreateBranch(repo.StoragePath, req.Name, req.Target); err != nil {
		respondError(w, http.StatusBadRequest, "branch_error", err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, map[string]any{
		"message": "Branch created successfully",
		"branch":  req.Name,
		"target":  req.Target,
	})
}

type addCollaboratorRequest struct {
	Username string          `json:"username"`
	Role     models.RepoRole `json:"role"`
}

type collaboratorResponse struct {
	ID          uint            `json:"id"`
	UserID      uint            `json:"user_id"`
	Username    string          `json:"username"`
	Email       string          `json:"email"`
	DisplayName string          `json:"display_name"`
	AvatarURL   string          `json:"avatar_url"`
	Role        models.RepoRole `json:"role"`
}

// GET /api/v1/repos/{owner}/{repo}/collaborators
func (h *Handler) ListCollaborators(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var members []models.RepositoryMember
	if err := h.db.Where("repository_id = ?", repo.ID).Find(&members).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not fetch collaborators")
		return
	}

	userIDs := make([]uint, len(members))
	for i, m := range members {
		userIDs[i] = m.UserID
	}

	var users []models.User
	if len(userIDs) > 0 {
		h.db.Where("id IN ?", userIDs).Find(&users)
	}

	userMap := make(map[uint]models.User)
	for _, u := range users {
		userMap[u.ID] = u
	}

	collabs := make([]collaboratorResponse, 0, len(members))
	for _, m := range members {
		u := userMap[m.UserID]
		collabs = append(collabs, collaboratorResponse{
			ID:          m.ID,
			UserID:      m.UserID,
			Username:    u.Username,
			Email:       u.Email,
			DisplayName: u.DisplayName,
			AvatarURL:   u.AvatarURL,
			Role:        m.Role,
		})
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"collaborators": collabs,
	})
}

// POST /api/v1/repos/{owner}/{repo}/collaborators
func (h *Handler) AddCollaborator(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if repo.OwnerID != uid {
		respondError(w, http.StatusForbidden, "forbidden", "Only repository owner can manage collaborators")
		return
	}

	var req addCollaboratorRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	if req.Username == "" {
		respondError(w, http.StatusUnprocessableEntity, "invalid_username", "Username is required")
		return
	}

	if req.Role == "" {
		req.Role = models.RoleWrite
	}

	var targetUser models.User
	if err := h.db.Where("username = ?", req.Username).First(&targetUser).Error; err != nil {
		respondError(w, http.StatusNotFound, "user_not_found", "User "+req.Username+" not found")
		return
	}

	if targetUser.ID == repo.OwnerID {
		respondError(w, http.StatusBadRequest, "owner_role", "Owner already has full access")
		return
	}

	var member models.RepositoryMember
	err := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, targetUser.ID).First(&member).Error
	if err == nil {
		member.Role = req.Role
		h.db.Save(&member)
	} else {
		member = models.RepositoryMember{
			RepositoryID: repo.ID,
			UserID:       targetUser.ID,
			Role:         req.Role,
		}
	h.db.Create(&member)
	}

	var actor models.User
	h.db.First(&actor, uid)
	h.NotifyUser(
		targetUser.ID,
		uid,
		&repo.ID,
		models.NotificationCollaborator,
		fmt.Sprintf("@%s added you as a %s collaborator on %s", actor.Username, req.Role, repo.FullName),
		fmt.Sprintf("You now have '%s' access to repository %s.", req.Role, repo.FullName),
		fmt.Sprintf("/repos/%s", repo.FullName),
	)

	respondJSON(w, http.StatusOK, map[string]any{
		"message": "Collaborator updated successfully",
		"username": targetUser.Username,
		"role":     req.Role,
	})
}

// DELETE /api/v1/repos/{owner}/{repo}/collaborators/{username}
func (h *Handler) RemoveCollaborator(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if repo.OwnerID != uid {
		respondError(w, http.StatusForbidden, "forbidden", "Only repository owner can manage collaborators")
		return
	}

	username := cleanParam(chi.URLParam(r, "username"))
	var targetUser models.User
	if err := h.db.Where("username = ?", username).First(&targetUser).Error; err != nil {
		respondError(w, http.StatusNotFound, "user_not_found", "User not found")
		return
	}

	h.db.Where("repository_id = ? AND user_id = ?", repo.ID, targetUser.ID).Delete(&models.RepositoryMember{})

	respondJSON(w, http.StatusOK, map[string]string{"message": "Collaborator removed"})
}

// GET /api/v1/repos/{owner}/{repo}/tree/{ref}/*path
func (h *Handler) GetTree(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	ref  := cleanParam(chi.URLParam(r, "ref"))
	path := cleanParam(chi.URLParam(r, "*"))

	tree, err := h.engine.TreeAt(repo.StoragePath, ref, path)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"ref":   ref,
		"path":  path,
		"items": tree,
	})
}

// GET /api/v1/repos/{owner}/{repo}/blob/{ref}/*path
func (h *Handler) GetBlob(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	ref      := cleanParam(chi.URLParam(r, "ref"))
	filePath := cleanParam(chi.URLParam(r, "*"))

	content, err := h.engine.BlobAt(repo.StoragePath, ref, filePath)
	if err != nil {
		respondError(w, http.StatusNotFound, "not_found",
			fmt.Sprintf("File not found: %s @ %s", filePath, ref))
		return
	}

	// Detect content type
	ct := http.DetectContentType(content)
	w.Header().Set("Content-Type", ct)
	w.Header().Set("X-Blob-Path", filePath)
	w.Header().Set("X-Blob-Ref", ref)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(content)
}

// ── Pull Request handlers ─────────────────────────────────────────────────

// POST /api/v1/repos/{owner}/{repo}/pulls
func (h *Handler) CreatePullRequest(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var req struct {
		Title        string `json:"title"`
		Body         string `json:"body"`
		SourceBranch string `json:"source_branch"`
		TargetBranch string `json:"target_branch"`
		IsDraft      bool   `json:"is_draft"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Title) == "" {
		respondError(w, http.StatusUnprocessableEntity, "required", "Title is required")
		return
	}

	pr := models.PullRequest{
		RepositoryID: repo.ID,
		AuthorID:     uid,
		Title:        req.Title,
		Body:         req.Body,
		State:        models.PROpen,
		SourceBranch: req.SourceBranch,
		TargetBranch: req.TargetBranch,
		IsDraft:      req.IsDraft,
	}

	if err := h.db.Create(&pr).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not create pull request")
		return
	}

	h.db.Preload("Author").First(&pr, pr.ID)
	respondJSON(w, http.StatusCreated, pr)
}

// GET /api/v1/repos/{owner}/{repo}/pulls
func (h *Handler) ListPullRequests(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	state := r.URL.Query().Get("state")
	if state == "" {
		state = "open"
	}

	var prs []models.PullRequest
	h.db.Preload("Author").
		Where("repository_id = ? AND state = ?", repo.ID, state).
		Order("created_at DESC").
		Find(&prs)

	respondJSON(w, http.StatusOK, map[string]any{"pull_requests": prs})
}

// POST /api/v1/repos/{owner}/{repo}/pulls/{id}/merge
func (h *Handler) MergePullRequest(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Write access required to merge pull requests")
		return
	}

	prID, _ := strconv.Atoi(chi.URLParam(r, "id"))
	var pr models.PullRequest
	if err := h.db.Where("id = ? AND repository_id = ?", prID, repo.ID).First(&pr).Error; err != nil {
		respondError(w, http.StatusNotFound, "not_found", "Pull request not found")
		return
	}

	if pr.State != models.PROpen {
		respondError(w, http.StatusBadRequest, "invalid_state", "Pull request is not open")
		return
	}

	metaDir := filepath.Join(repo.StoragePath, ".drag")
	if _, err := os.Stat(metaDir); os.IsNotExist(err) {
		metaDir = filepath.Join(repo.StoragePath, ".drag")
	}
	sourceHash, _ := h.engine.ResolveRef(metaDir, pr.SourceBranch)
	if sourceHash == "" {
		respondError(w, http.StatusBadRequest, "source_not_found", "Source branch ref not found")
		return
	}

	targetRefPath := filepath.Join(metaDir, "refs", "heads", pr.TargetBranch)
	if err := os.MkdirAll(filepath.Dir(targetRefPath), 0o755); err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}
	if err := os.WriteFile(targetRefPath, []byte(sourceHash+"\n"), 0o644); err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}

	now := time.Now()
	pr.State = models.PRMerged
	pr.MergeCommit = sourceHash
	pr.MergedByID = &uid
	pr.MergedAt = &now
	h.db.Save(&pr)

	h.db.Preload("Author").First(&pr, pr.ID)
	respondJSON(w, http.StatusOK, map[string]any{
		"message":      "Pull request merged successfully",
		"pull_request": pr,
	})
}

// POST /api/v1/repos/{owner}/{repo}/pulls/{id}/close
func (h *Handler) ClosePullRequest(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	prID, _ := strconv.Atoi(chi.URLParam(r, "id"))

	var pr models.PullRequest
	if err := h.db.Where("id = ? AND repository_id = ?", prID, repo.ID).First(&pr).Error; err != nil {
		respondError(w, http.StatusNotFound, "not_found", "Pull request not found")
		return
	}

	if pr.AuthorID != uid && !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Access denied")
		return
	}

	if pr.State != models.PROpen {
		respondError(w, http.StatusBadRequest, "invalid_state", "Pull request is not open")
		return
	}

	now := time.Now()
	pr.State = models.PRClosed
	pr.ClosedAt = &now
	h.db.Save(&pr)

	h.db.Preload("Author").First(&pr, pr.ID)
	respondJSON(w, http.StatusOK, map[string]any{
		"message":      "Pull request closed",
		"pull_request": pr,
	})
}

// ── Issue handlers ────────────────────────────────────────────────────────

// POST /api/v1/repos/{owner}/{repo}/issues
func (h *Handler) CreateIssue(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var req struct {
		Title string `json:"title"`
		Body  string `json:"body"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	// Get next issue number for this repo
	var count int64
	h.db.Model(&models.Issue{}).Where("repository_id = ?", repo.ID).Count(&count)

	issue := models.Issue{
		RepositoryID: repo.ID,
		AuthorID:     uid,
		Number:       int(count) + 1,
		Title:        req.Title,
		Body:         req.Body,
		State:        models.IssueOpen,
	}

	if err := h.db.Create(&issue).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not create issue")
		return
	}

	h.db.Preload("Author").First(&issue, issue.ID)
	respondJSON(w, http.StatusCreated, issue)
}

// GET /api/v1/repos/{owner}/{repo}/issues
func (h *Handler) ListIssues(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	state := r.URL.Query().Get("state")
	if state == "" {
		state = "open"
	}

	var issues []models.Issue
	h.db.Preload("Author").
		Where("repository_id = ? AND state = ?", repo.ID, state).
		Order("number ASC").
		Find(&issues)

	respondJSON(w, http.StatusOK, map[string]any{"issues": issues})
}

// ── Helpers ───────────────────────────────────────────────────────────────

func cleanParam(s string) string {
	if u, err := url.PathUnescape(s); err == nil {
		return u
	}
	return s
}

func isNotFound(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "record not found") || strings.Contains(msg, "not found")
}

func (h *Handler) loadRepo(w http.ResponseWriter, r *http.Request) (*models.Repository, bool) {
	owner := cleanParam(chi.URLParam(r, "owner"))
	name  := cleanParam(chi.URLParam(r, "repo"))
	fullName := owner + "/" + name

	var repo models.Repository
	if err := h.db.Preload("Owner").Where("full_name = ?", fullName).First(&repo).Error; err != nil {
		if isNotFound(err) {
			respondError(w, http.StatusNotFound, "not_found",
				"Repository "+fullName+" not found")
			return nil, false
		}
		respondError(w, http.StatusInternalServerError, "db_error", "Database error: "+err.Error())
		return nil, false
	}

	// Visibility check
	uid := middleware.GetUserID(r)
	if repo.Visibility == models.VisibilityPrivate && repo.OwnerID != uid {
		var member models.RepositoryMember
		if err := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, uid).
			First(&member).Error; err != nil {
			respondError(w, http.StatusNotFound, "not_found",
				"Repository not found or access denied")
			return nil, false
		}
	}

	return &repo, true
}

func (h *Handler) toRepoResponse(r *http.Request, repo *models.Repository) repoResponse {
	host := r.Host
	uid := middleware.GetUserID(r)

	perms := RepoPermissions{
		Admin: false,
		Push:  false,
		Pull:  repo.Visibility == models.VisibilityPublic,
	}

	if uid != 0 {
		if uid == repo.OwnerID {
			perms.Admin = true
			perms.Push = true
			perms.Pull = true
		} else {
			var member models.RepositoryMember
			if err := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, uid).First(&member).Error; err == nil {
				perms.Pull = true
				if member.Role == models.RoleOwner || member.Role == models.RoleAdmin {
					perms.Admin = true
					perms.Push = true
				} else if member.Role == models.RoleWrite || member.Role == models.RoleMaintainer {
					perms.Push = true
				}
			}
		}
	}

	return repoResponse{
		Repository:  *repo,
		CloneURL:    fmt.Sprintf("http://%s/api/v1/repos/%s.drag", host, repo.FullName),
		SSHURL:      fmt.Sprintf("drag@%s:%s.drag", host, repo.FullName),
		Permissions: perms,
	}
}

// ── Star Handlers ─────────────────────────────────────────────────────────

// POST /api/v1/repos/{owner}/{repo}/star
func (h *Handler) StarRepo(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required to star a repository")
		return
	}

	var existing models.Star
	err := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, uid).First(&existing).Error
	if err != nil {
		star := models.Star{
			RepositoryID: repo.ID,
			UserID:       uid,
		}
		h.db.Create(&star)

		h.db.Model(repo).UpdateColumn("star_count", gorm.Expr("star_count + 1"))
		repo.StarCount++

		var actor models.User
		h.db.First(&actor, uid)
		h.NotifyUser(
			repo.OwnerID,
			uid,
			&repo.ID,
			models.NotificationStar,
			fmt.Sprintf("@%s starred your repository %s", actor.Username, repo.FullName),
			"",
			fmt.Sprintf("/repos/%s", repo.FullName),
		)
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"message":    "Repository starred",
		"starred":    true,
		"star_count": repo.StarCount,
	})
}

// DELETE /api/v1/repos/{owner}/{repo}/star
func (h *Handler) UnstarRepo(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	result := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, uid).Delete(&models.Star{})
	if result.RowsAffected > 0 {
		if repo.StarCount > 0 {
			h.db.Model(repo).UpdateColumn("star_count", gorm.Expr("GREATEST(star_count - 1, 0)"))
			repo.StarCount--
		}
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"message":    "Repository unstarred",
		"starred":    false,
		"star_count": repo.StarCount,
	})
}

// GET /api/v1/repos/{owner}/{repo}/star
func (h *Handler) GetStarStatus(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	starred := false
	if uid > 0 {
		var existing models.Star
		if err := h.db.Where("repository_id = ? AND user_id = ?", repo.ID, uid).First(&existing).Error; err == nil {
			starred = true
		}
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"starred":    starred,
		"star_count": repo.StarCount,
	})
}

// POST /api/v1/repos/{owner}/{repo}/fork
func (h *Handler) ForkRepo(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required to fork repository")
		return
	}

	sourceRepo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "User not found")
		return
	}

	targetName := sourceRepo.Name
	fullName := user.Username + "/" + targetName

	// If fork already exists under user namespace
	var existing models.Repository
	if err := h.db.Where("full_name = ?", fullName).First(&existing).Error; err == nil {
		// Return existing fork
		respondJSON(w, http.StatusOK, h.toRepoResponse(r, &existing))
		return
	}

	storagePath := h.engine.RepoPath(user.Username, targetName)
	if err := h.engine.InitRepo(storagePath); err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", fmt.Sprintf("Could not initialize fork: %v", err))
		return
	}

	forkRepo := models.Repository{
		OwnerID:       uid,
		Name:          targetName,
		FullName:      fullName,
		Description:   fmt.Sprintf("Forked from %s", sourceRepo.FullName),
		Visibility:    models.VisibilityPublic,
		DefaultBranch: sourceRepo.DefaultBranch,
		StoragePath:   storagePath,
		IsFork:        true,
		ForkedFromID:  &sourceRepo.ID,
	}

	if err := h.db.Create(&forkRepo).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not create fork repository")
		return
	}

	h.db.Create(&models.RepositoryMember{
		RepositoryID: forkRepo.ID,
		UserID:       uid,
		Role:         models.RoleOwner,
	})

	h.db.Model(sourceRepo).UpdateColumn("fork_count", gorm.Expr("fork_count + 1"))
	sourceRepo.ForkCount++

	h.NotifyUser(
		sourceRepo.OwnerID,
		uid,
		&sourceRepo.ID,
		models.NotificationFork,
		fmt.Sprintf("@%s forked your repository %s", user.Username, sourceRepo.FullName),
		fmt.Sprintf("New fork created at %s.", forkRepo.FullName),
		fmt.Sprintf("/repos/%s", forkRepo.FullName),
	)

	respondJSON(w, http.StatusCreated, h.toRepoResponse(r, &forkRepo))
}

// ── Date formatting helper ────────────────────────────────────────────────
var _ = time.Now // suppress unused import if time is only used in models
