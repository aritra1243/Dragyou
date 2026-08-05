package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Bio         string `json:"bio"`
	AvatarURL   string `json:"avatar_url"`
	NewPassword string `json:"new_password,omitempty"`
}

// GET /api/v1/users/:username
func (h *Handler) GetUser(w http.ResponseWriter, r *http.Request) {
	username := cleanParam(chi.URLParam(r, "username"))

	var user models.User
	if err := h.db.Where("username = ?", username).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			respondError(w, http.StatusNotFound, "not_found",
				"User '"+username+"' not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "db_error", "Database error")
		return
	}

	respondJSON(w, http.StatusOK, user.ToPublic())
}

// GET /api/v1/users/:username/repos
func (h *Handler) GetUserRepos(w http.ResponseWriter, r *http.Request) {
	username := cleanParam(chi.URLParam(r, "username"))

	var user models.User
	if err := h.db.Where("username = ?", username).First(&user).Error; err != nil {
		respondError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}

	var repos []models.Repository
	h.db.Preload("Owner").
		Where("owner_id = ? AND visibility = ?", user.ID, models.VisibilityPublic).
		Order("updated_at DESC").
		Limit(30).
		Find(&repos)

	items := make([]repoResponse, len(repos))
	for i := range repos {
		items[i] = h.toRepoResponse(r, &repos[i])
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"user":  user.ToPublic(),
		"repos": items,
	})
}

// PUT /api/v1/users/profile
func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		respondError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON body")
		return
	}

	user.DisplayName = req.DisplayName
	user.Bio = req.Bio
	user.AvatarURL = req.AvatarURL

	if req.Email != "" && req.Email != user.Email {
		var count int64
		h.db.Model(&models.User{}).Where("email = ? AND id != ?", req.Email, user.ID).Count(&count)
		if count > 0 {
			respondError(w, http.StatusConflict, "email_taken", "Email address is already in use")
			return
		}
		user.Email = req.Email
	}

	if req.NewPassword != "" {
		if len(req.NewPassword) < 6 {
			respondError(w, http.StatusBadRequest, "weak_password", "Password must be at least 6 characters")
			return
		}
		hashed, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "hash_error", "Failed to hash password")
			return
		}
		user.PasswordHash = string(hashed)
	}

	if err := h.db.Save(&user).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Failed to save profile updates: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"message": "Profile updated successfully",
		"user":    user.ToPublic(),
	})
}
