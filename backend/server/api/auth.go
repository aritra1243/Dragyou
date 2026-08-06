package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
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

// ── Google OAuth Handlers ──────────────────────────────────────────────────

// GET /api/v1/auth/google
func (h *Handler) GoogleAuth(w http.ResponseWriter, r *http.Request) {
	if h.cfg.GoogleClientID == "" {
		respondError(w, http.StatusBadRequest, "google_auth_disabled",
			"Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend environment.")
		return
	}

	scope := "openid email profile"
	authURL := "https://accounts.google.com/o/oauth2/v2/auth?" +
		"client_id=" + h.cfg.GoogleClientID +
		"&redirect_uri=" + h.cfg.GoogleRedirectURI +
		"&response_type=code" +
		"&scope=" + scope +
		"&access_type=offline" +
		"&prompt=consent"

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// GET /api/v1/auth/google/callback
func (h *Handler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		respondError(w, http.StatusBadRequest, "missing_code", "Authorization code missing from Google callback")
		return
	}

	// Exchange code for Google Access Token
	resp, err := http.PostForm("https://oauth2.googleapis.com/token", map[string][]string{
		"code":          {code},
		"client_id":     {h.cfg.GoogleClientID},
		"client_secret": {h.cfg.GoogleClientSecret},
		"redirect_uri":  {h.cfg.GoogleRedirectURI},
		"grant_type":    {"authorization_code"},
	})
	if err != nil || resp.StatusCode != http.StatusOK {
		respondError(w, http.StatusInternalServerError, "oauth_exchange_failed", "Failed to exchange authorization code with Google")
		return
	}
	defer resp.Body.Close()

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		IDToken     string `json:"id_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		respondError(w, http.StatusInternalServerError, "oauth_decode_failed", "Failed to parse Google token response")
		return
	}

	// Fetch user info from Google
	reqInfo, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v2/userinfo", nil)
	reqInfo.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)
	client := &http.Client{Timeout: 10 * time.Second}
	infoResp, err := client.Do(reqInfo)
	if err != nil || infoResp.StatusCode != http.StatusOK {
		respondError(w, http.StatusInternalServerError, "google_userinfo_failed", "Failed to fetch Google user profile")
		return
	}
	defer infoResp.Body.Close()

	var googleUser struct {
		ID            string `json:"id"`
		Email         string `json:"email"`
		VerifiedEmail bool   `json:"verified_email"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}
	if err := json.NewDecoder(infoResp.Body).Decode(&googleUser); err != nil {
		respondError(w, http.StatusInternalServerError, "google_userinfo_decode_failed", "Failed to decode Google user profile")
		return
	}

	// Find or register user by email
	var user models.User
	err = h.db.Where("email = ?", strings.ToLower(googleUser.Email)).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Generate unique username from Google email/name
		baseUsername := strings.ToLower(regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(googleUser.Name, ""))
		if len(baseUsername) < 3 {
			baseUsername = strings.Split(googleUser.Email, "@")[0]
		}
		if len(baseUsername) > 30 {
			baseUsername = baseUsername[:30]
		}

		username := baseUsername
		var count int64
		h.db.Model(&models.User{}).Where("username = ?", username).Count(&count)
		if count > 0 {
			username = fmt.Sprintf("%s_%d", baseUsername, time.Now().Unix()%10000)
		}

		user = models.User{
			Username:    username,
			Email:       strings.ToLower(googleUser.Email),
			DisplayName: googleUser.Name,
			AvatarURL:   googleUser.Picture,
			IsActive:    true,
		}
		if err := h.db.Create(&user).Error; err != nil {
			respondError(w, http.StatusInternalServerError, "user_creation_failed", "Could not create user account for Google profile")
			return
		}
	} else if err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	// Issue Dragyou session tokens
	access, _, err := h.issueTokens(&user)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "token_error", "Failed to issue session token")
		return
	}

	frontendURL := "http://localhost:3000"
	if len(h.cfg.AllowedOrigins) > 0 {
		frontendURL = h.cfg.AllowedOrigins[0]
	}

	userJSON, _ := json.Marshal(user.ToPublic())
	redirectTarget := fmt.Sprintf("%s/login?token=%s&user=%s", frontendURL, access, url.QueryEscape(string(userJSON)))
	http.Redirect(w, r, redirectTarget, http.StatusTemporaryRedirect)
}

type googleTokenRequest struct {
	Email       string `json:"email"`
	Name        string `json:"name"`
	GoogleID    string `json:"google_id"`
	AvatarURL   string `json:"avatar_url"`
	IDToken     string `json:"id_token,omitempty"`
}

// POST /api/v1/auth/google/token
func (h *Handler) GoogleTokenAuth(w http.ResponseWriter, r *http.Request) {
	var req googleTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid_json", "Invalid JSON payload")
		return
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !emailRe.MatchString(req.Email) {
		respondError(w, http.StatusBadRequest, "invalid_email", "A valid Google account email is required")
		return
	}

	var user models.User
	err := h.db.Where("email = ?", req.Email).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		baseUsername := strings.ToLower(regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(req.Name, ""))
		if len(baseUsername) < 3 {
			baseUsername = strings.Split(req.Email, "@")[0]
		}
		if len(baseUsername) > 30 {
			baseUsername = baseUsername[:30]
		}

		username := baseUsername
		var count int64
		h.db.Model(&models.User{}).Where("username = ?", username).Count(&count)
		if count > 0 {
			username = fmt.Sprintf("%s_%d", baseUsername, time.Now().Unix()%10000)
		}

		user = models.User{
			Username:    username,
			Email:       req.Email,
			DisplayName: req.Name,
			AvatarURL:   req.AvatarURL,
			IsActive:    true,
		}
		if err := h.db.Create(&user).Error; err != nil {
			respondError(w, http.StatusInternalServerError, "user_creation_failed", "Could not create user account for Google profile")
			return
		}
	} else if err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", err.Error())
		return
	}

	access, refresh, err := h.issueTokens(&user)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "token_error", "Failed to issue session token")
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
