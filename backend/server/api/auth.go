package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// ── Validation ─────────────────────────────────────────────────────────────

var (
	usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_\-]{3,64}$`)
	emailRe    = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)
)

// ── Request / Response types ───────────────────────────────────────────────

type registerRequest struct {
	Username    string `json:"username"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	DisplayName string `json:"display_name"`
}

type loginRequest struct {
	Username string `json:"username"` // also accepts email
	Password string `json:"password"`
}

type authResponse struct {
	AccessToken  string              `json:"access_token"`
	TokenType    string              `json:"token_type"`
	ExpiresIn    int                 `json:"expires_in"` // seconds
	RefreshToken string              `json:"refresh_token,omitempty"`
	User         models.PublicProfile `json:"user"`
}

// ── Handlers ───────────────────────────────────────────────────────────────

// POST /api/v1/auth/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	// Validate
	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	if !usernameRe.MatchString(req.Username) {
		respondError(w, http.StatusUnprocessableEntity, "invalid_username",
			"Username must be 3–64 chars and contain only letters, digits, _ or -")
		return
	}
	if !emailRe.MatchString(req.Email) {
		respondError(w, http.StatusUnprocessableEntity, "invalid_email", "Invalid email address")
		return
	}
	if len(req.Password) < 8 {
		respondError(w, http.StatusUnprocessableEntity, "weak_password",
			"Password must be at least 8 characters")
		return
	}

	// Check uniqueness
	var existing models.User
	if err := h.db.Where("username = ? OR email = ?", req.Username, req.Email).
		First(&existing).Error; err == nil {
		respondError(w, http.StatusConflict, "already_exists",
			"Username or email is already taken")
		return
	}

	// Hash password (bcrypt cost=12; upgrade to Argon2id in Phase 5)
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "internal", "Failed to hash password")
		return
	}

	user := models.User{
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(hash),
		DisplayName:  req.DisplayName,
		IsActive:     true,
	}
	if user.DisplayName == "" {
		user.DisplayName = user.Username
	}

	if err := h.db.Create(&user).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Could not create user")
		return
	}

	// Issue tokens
	access, refresh, err := h.issueTokens(&user)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "token_error", "Could not issue token")
		return
	}

	respondJSON(w, http.StatusCreated, authResponse{
		AccessToken:  access,
		TokenType:    "Bearer",
		ExpiresIn:    h.cfg.JWTExpiryMinutes * 60,
		RefreshToken: refresh,
		User:         user.ToPublic(),
	})
}

// POST /api/v1/auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Request body is not valid JSON")
		return
	}

	req.Username = strings.TrimSpace(req.Username)

	// Find by username or email
	var user models.User
	query := h.db.Where("username = ?", req.Username)
	if strings.Contains(req.Username, "@") {
		query = h.db.Where("email = ?", strings.ToLower(req.Username))
	}

	if err := query.First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Constant-time response to prevent user enumeration
			_ = bcrypt.CompareHashAndPassword([]byte("$2a$12$fakehash"), []byte(req.Password))
			respondError(w, http.StatusUnauthorized, "invalid_credentials",
				"Invalid username or password")
			return
		}
		respondError(w, http.StatusInternalServerError, "db_error", "Database error")
		return
	}

	if !user.IsActive {
		respondError(w, http.StatusForbidden, "account_inactive", "Account is disabled")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		respondError(w, http.StatusUnauthorized, "invalid_credentials",
			"Invalid username or password")
		return
	}

	access, refresh, err := h.issueTokens(&user)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "token_error", "Could not issue token")
		return
	}

	respondJSON(w, http.StatusOK, authResponse{
		AccessToken:  access,
		TokenType:    "Bearer",
		ExpiresIn:    h.cfg.JWTExpiryMinutes * 60,
		RefreshToken: refresh,
		User:         user.ToPublic(),
	})
}

// GET /api/v1/auth/me
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	var user models.User
	if err := h.db.First(&user, uid).Error; err != nil {
		respondError(w, http.StatusNotFound, "not_found", "User not found")
		return
	}
	respondJSON(w, http.StatusOK, user.ToPublic())
}

// POST /api/v1/auth/logout  (client-side: discard token; future: blacklist)
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// GET /api/v1/download/drag
func (h *Handler) DownloadDragClient(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Disposition", "attachment; filename=\"drag.exe\"")
	http.ServeFile(w, r, h.cfg.DragBin)
}

// ── Token helpers ─────────────────────────────────────────────────────────

func (h *Handler) issueTokens(user *models.User) (access, refresh string, err error) {
	now := time.Now().UTC()

	// Access token (short-lived)
	accessClaims := &middleware.Claims{
		UserID:   user.ID,
		Username: user.Username,
		IsAdmin:  user.IsAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.Username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(h.cfg.JWTExpiryMinutes) * time.Minute)),
			Issuer:    "dragyou",
		},
	}
	access, err = jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).
		SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return
	}

	// Refresh token (long-lived, minimal claims)
	refreshClaims := &middleware.Claims{
		UserID:   user.ID,
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.Username,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(time.Duration(h.cfg.JWTRefreshExpiryDays) * 24 * time.Hour)),
			Issuer:    "dragyou-refresh",
		},
	}
	refresh, err = jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).
		SignedString([]byte(h.cfg.JWTSecret))
	return
}
