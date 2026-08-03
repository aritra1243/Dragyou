package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
)

// ── Push protocol ─────────────────────────────────────────────────────────

type negotiateRequest struct {
	Have  []string `json:"have"`
	Want  []string `json:"want"`
	Ref   string   `json:"ref"`
	Force bool     `json:"force"`
}

type negotiateResponse struct {
	Need  []string `json:"need"`
	Ready bool     `json:"ready"`
}

// POST /api/v1/repos/:owner/:repo/push/negotiate
func (h *Handler) PushNegotiate(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Write access required")
		return
	}

	var req negotiateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid request")
		return
	}

	// Build the set of objects the client already has (from the "have" list)
	clientHave := make(map[string]bool, len(req.Have))
	for _, h := range req.Have {
		if h != "" {
			clientHave[h] = true
		}
	}

	// Walk the server's own object store to determine what it possesses.
	// The server must ask the client for every object that:
	//   (a) appears in the client's "want" list (the push tip), AND
	//   (b) is NOT already present in the server's object store.
	//
	// We seed the need-set with the push tip(s) from "want", then
	// return only those that the server doesn't have.  A full
	// implementation would walk the commit graph; here we correctly
	// compute the diff between the client's have-set and server store.
	serverHasObj := func(hash string) bool {
		if hash == "" {
			return false
		}
		objDir := repo.StoragePath + "/.nova/objects/" + hash[:2]
		objFile := objDir + "/" + hash[2:]
		_, err := os.Stat(objFile)
		return err == nil
	}

	// Collect all objects the server needs: those the client "wants" to
	// push that the server doesn't already store.
	var need []string
	for _, h := range req.Want {
		if h == "" {
			continue
		}
		if !serverHasObj(h) {
			need = append(need, h)
		}
	}

	// Also request any objects the client listed in "have" that we don't
	// have — these are the intermediate commits/trees/blobs the client
	// knows about and that are reachable from the tip.
	for _, h := range req.Have {
		if h == "" {
			continue
		}
		if !serverHasObj(h) {
			need = append(need, h)
		}
	}

	// Deduplicate
	seen := make(map[string]bool, len(need))
	deduped := need[:0]
	for _, h := range need {
		if !seen[h] {
			seen[h] = true
			deduped = append(deduped, h)
		}
	}
	need = deduped

	// Check for non-fast-forward (atomic ref protection)
	if !req.Force && req.Ref != "" {
		// TODO: read current ref tip and verify it's an ancestor of the pushed tip
	}

	if need == nil {
		need = []string{}
	}

	respondJSON(w, http.StatusOK, negotiateResponse{
		Need:  need,
		Ready: true,
	})
}

// POST /api/v1/repos/:owner/:repo/push/pack
func (h *Handler) PushPack(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	uid := middleware.GetUserID(r)
	if !h.canWrite(repo, uid) {
		respondError(w, http.StatusForbidden, "forbidden", "Write access required")
		return
	}

	// Read pack data
	const maxPackSize = 5 * 1024 * 1024 * 1024 // 5 GB limit
	packData, err := io.ReadAll(io.LimitReader(r.Body, maxPackSize))
	if err != nil {
		respondError(w, http.StatusBadRequest, "read_error", "Failed to read pack data")
		return
	}

	if len(packData) == 0 {
		respondJSON(w, http.StatusOK, map[string]string{"status": "nothing to do"})
		return
	}

	// Apply pack via engine bridge
	if err := h.engine.ApplyPack(repo.StoragePath, packData); err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error",
			fmt.Sprintf("Failed to apply pack: %v", err))
		return
	}

	// Update the ref
	ref := r.Header.Get("X-Dragyou-Ref")
	tip := r.Header.Get("X-Dragyou-Tip")
	if ref != "" && tip != "" {
		if err := h.engine.UpdateRef(repo.StoragePath, ref, tip); err != nil {
			respondError(w, http.StatusInternalServerError, "ref_error",
				fmt.Sprintf("Failed to update ref: %v", err))
			return
		}
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"status":  "ok",
		"objects": "applied",
	})
}

// ── Fetch protocol ────────────────────────────────────────────────────────

type fetchRequest struct {
	Have []string `json:"have"`
	Want []string `json:"want"` // ref names like "refs/heads/main"
}

// POST /api/v1/repos/:owner/:repo/fetch
func (h *Handler) Fetch(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var req fetchRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid request")
		return
	}

	// Build the pack of needed objects via engine bridge
	packData, err := h.engine.BuildFetchPack(repo.StoragePath, req.Have, req.Want)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error", err.Error())
		return
	}

	if len(packData) == 0 {
		// Nothing to send
		w.WriteHeader(http.StatusNoContent)
		return
	}

	w.Header().Set("Content-Type", "application/x-dragyou-pack")
	w.Header().Set("Content-Length", strconv.Itoa(len(packData)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(packData)
}

// ── Clone protocol ────────────────────────────────────────────────────────

// POST /api/v1/repos/:owner/:repo/clone
func (h *Handler) Clone(w http.ResponseWriter, r *http.Request) {
	repo, ok := h.loadRepo(w, r)
	if !ok {
		return
	}

	var req struct {
		Depth  int    `json:"depth"`
		Branch string `json:"branch"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if req.Branch == "" {
		req.Branch = repo.DefaultBranch
	}

	// Build clone pack (metadata only: commits + trees, no blobs)
	packData, err := h.engine.BuildClonePack(repo.StoragePath, req.Branch, req.Depth)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "engine_error",
			fmt.Sprintf("Clone failed: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/x-dragyou-pack")
	w.Header().Set("Content-Length", strconv.Itoa(len(packData)))
	w.Header().Set("X-Dragyou-Branch", req.Branch)
	w.Header().Set("X-Dragyou-Repo", repo.FullName)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(packData)
}

// ── Permission helpers ────────────────────────────────────────────────────

func (h *Handler) canWrite(repo *models.Repository, uid uint) bool {
	if uid == 0 {
		return false
	}
	if repo.OwnerID == uid {
		return true
	}
	var member models.RepositoryMember
	err := h.db.Where("repository_id = ? AND user_id = ? AND role IN ?",
		repo.ID, uid,
		[]models.RepoRole{models.RoleOwner, models.RoleAdmin, models.RoleMaintainer, models.RoleWrite}).
		First(&member).Error
	return err == nil
}
