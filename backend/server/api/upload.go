package api

import (
	"io"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
)

// POST /api/v1/repos/{owner}/{repo}/upload
//
// Multipart form fields:
//   - files[]  — one or more files to commit (max 50 files, 50 MB each, 100 MB total)
//   - message  — commit message (optional, defaults to "Upload files via web")
//   - branch   — branch to push to (optional, defaults to the repo's default branch)
func (h *Handler) UploadFiles(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Write access required")
		return
	}

	// Load user so we can set author name/email in the commit object
	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not load user")
		return
	}

	// Parse multipart form — 100 MB total memory limit
	const maxTotal = 100 << 20 // 100 MB
	if err := r.ParseMultipartForm(maxTotal); err != nil {
		respondError(w, http.StatusBadRequest, "parse_error", "Could not parse multipart form: "+err.Error())
		return
	}

	message := strings.TrimSpace(r.FormValue("message"))
	if message == "" {
		message = "Upload files via web"
	}

	branch := strings.TrimSpace(r.FormValue("branch"))
	if branch == "" {
		branch = repo.DefaultBranch
	}
	if branch == "" {
		branch = "main"
	}

	// Collect uploaded files
	const maxFiles = 50
	const maxPerFile = 50 << 20 // 50 MB per file

	files := make(map[string][]byte)
	for _, fh := range r.MultipartForm.File["files[]"] {
		if len(files) >= maxFiles {
			respondError(w, http.StatusBadRequest, "too_many_files",
				"Maximum 50 files per upload")
			return
		}

		f, err := fh.Open()
		if err != nil {
			respondError(w, http.StatusBadRequest, "file_error",
				"Could not open file: "+fh.Filename)
			return
		}
		data, err := io.ReadAll(io.LimitReader(f, maxPerFile))
		f.Close()
		if err != nil {
			respondError(w, http.StatusBadRequest, "file_error",
				"Could not read file: "+fh.Filename)
			return
		}

		// Use only the base filename (no directory traversal)
		name := filepath.Base(fh.Filename)
		if name == "." || name == "/" {
			name = "file"
		}
		files[name] = data
	}

	if len(files) == 0 {
		respondError(w, http.StatusBadRequest, "no_files", "No files provided")
		return
	}

	// Commit via engine bridge (pure Go, no CLI)
	commitHash, err := h.engine.WebCommit(
		repo.StoragePath,
		branch,
		message,
		user.Username,
		user.Email,
		files,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "commit_error",
			"Could not commit files: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"commit":  commitHash[:8],
		"files":   len(files),
		"branch":  branch,
		"message": message,
	})
}
