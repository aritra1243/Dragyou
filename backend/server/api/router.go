package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/dragyou/server/config"
	"github.com/dragyou/server/engine"
	mw "github.com/dragyou/server/middleware"
	"gorm.io/gorm"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	cfg    *config.Config
	db     *gorm.DB
	engine *engine.Bridge
}

// NewRouter builds the full Chi router with all routes and middleware.
func NewRouter(cfg *config.Config, db *gorm.DB) *chi.Mux {
	h := &Handler{
		cfg:    cfg,
		db:     db,
		engine: engine.NewBridge(cfg.NovaBin, cfg.RepoStoragePath),
	}

	r := chi.NewRouter()

	// ── Global middleware ─────────────────────────────────────────────────
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.CleanPath)
	r.Use(middleware.StripSlashes)

	// CORS — dynamic matching for Vercel, localhost, and custom CORS_ORIGIN
	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			return true
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Request-ID", "X-Dragyou-Ref", "X-Dragyou-Tip"},
		ExposedHeaders:   []string{"Link", "X-Total-Count", "X-Request-ID"},
		AllowCredentials: true,
		MaxAge:           86400,
	}))

	// Rate limiting (runs after optional auth so we can distinguish anon vs authed)
	r.Use(mw.OptionalAuth(cfg.JWTSecret))
	r.Use(mw.RateLimit(cfg.RateLimitAnon, cfg.RateLimitAuthed))

	// ── Health & info ─────────────────────────────────────────────────────
	r.Get("/health", h.Health)
	r.Get("/", h.APIInfo)

	// ── API v1 ────────────────────────────────────────────────────────────
	r.Route("/api/v1", func(r chi.Router) {
		r.Get("/download/nova", h.DownloadNovaClient)

		// Auth (public)
		r.Route("/auth", func(r chi.Router) {
			r.Post("/register", h.Register)
			r.Post("/login", h.Login)
			r.Post("/logout", h.Logout)
			r.With(mw.Auth(cfg.JWTSecret)).Get("/me", h.Me)
			r.With(mw.Auth(cfg.JWTSecret)).Put("/me", h.UpdateProfile)
		})

		// Users
		r.Route("/users", func(r chi.Router) {
			r.With(mw.Auth(cfg.JWTSecret)).Put("/profile", h.UpdateProfile)
			r.Get("/search", h.SearchUsers)
			r.Get("/{username}", h.GetUser)
			r.Get("/{username}/repos", h.GetUserRepos)
		})

		// Repositories
		r.Route("/repos", func(r chi.Router) {
			r.With(mw.Auth(cfg.JWTSecret)).Post("/", h.CreateRepo)
			r.Get("/", h.ListRepos)

			r.Route("/{owner}/{repo}", func(r chi.Router) {
				r.Get("/", h.GetRepo)
				r.With(mw.Auth(cfg.JWTSecret)).Delete("/", h.DeleteRepo)

				// VCS data
				r.Get("/commits", h.GetCommits)
				r.Get("/branches", h.GetBranches)
				r.With(mw.Auth(cfg.JWTSecret)).Post("/branches", h.CreateBranch)
				r.Get("/tree/{ref}", h.GetTree)
				r.Get("/tree/{ref}/*", h.GetTree)
				r.Get("/blob/{ref}/*", h.GetBlob)

				// Star
				r.Get("/star", h.GetStarStatus)
				r.With(mw.Auth(cfg.JWTSecret)).Post("/star", h.StarRepo)
				r.With(mw.Auth(cfg.JWTSecret)).Delete("/star", h.UnstarRepo)

				// Collaborators
				r.Route("/collaborators", func(r chi.Router) {
					r.Get("/", h.ListCollaborators)
					r.With(mw.Auth(cfg.JWTSecret)).Post("/", h.AddCollaborator)
					r.With(mw.Auth(cfg.JWTSecret)).Delete("/{username}", h.RemoveCollaborator)
				})

				// Phase 4 — Remote protocol
				r.Route("/push", func(r chi.Router) {
					r.Use(mw.Auth(cfg.JWTSecret))
					r.Post("/negotiate", h.PushNegotiate)
					r.Post("/pack", h.PushPack)
				})
				r.Post("/fetch", h.Fetch)
				r.Post("/clone", h.Clone)

				// Web upload (drag-and-drop from browser)
				r.With(mw.Auth(cfg.JWTSecret)).Post("/upload", h.UploadFiles)

				// Pull Requests
				r.Route("/pulls", func(r chi.Router) {
					r.Get("/", h.ListPullRequests)
					r.With(mw.Auth(cfg.JWTSecret)).Post("/", h.CreatePullRequest)
					r.With(mw.Auth(cfg.JWTSecret)).Post("/{id}/merge", h.MergePullRequest)
					r.With(mw.Auth(cfg.JWTSecret)).Post("/{id}/close", h.ClosePullRequest)
				})

				// Issues
				r.Route("/issues", func(r chi.Router) {
					r.Get("/", h.ListIssues)
					r.With(mw.Auth(cfg.JWTSecret)).Post("/", h.CreateIssue)
				})
			})
		})
	})

	return r
}

// ── Utility handlers ──────────────────────────────────────────────────────

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	// Check DB
	sqlDB, err := h.db.DB()
	dbStatus := "ok"
	if err != nil || sqlDB.Ping() != nil {
		dbStatus = "error"
	}

	code := http.StatusOK
	if dbStatus != "ok" {
		code = http.StatusServiceUnavailable
	}

	respondJSON(w, code, map[string]any{
		"status":   "ok",
		"database": dbStatus,
		"version":  "0.1.0",
	})
}

func (h *Handler) APIInfo(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]any{
		"name":    "Dragyou VCS API",
		"version": "v1",
		"docs":    "/api/v1",
		"endpoints": []string{
			"POST /api/v1/auth/register",
			"POST /api/v1/auth/login",
			"GET  /api/v1/auth/me",
			"GET  /api/v1/users/:username",
			"GET  /api/v1/repos",
			"POST /api/v1/repos",
			"GET  /api/v1/repos/:owner/:repo",
			"GET  /api/v1/repos/:owner/:repo/commits",
			"GET  /api/v1/repos/:owner/:repo/branches",
			"GET  /api/v1/repos/:owner/:repo/tree/:ref/*",
			"GET  /api/v1/repos/:owner/:repo/blob/:ref/*",
			"GET  /api/v1/repos/:owner/:repo/pulls",
			"POST /api/v1/repos/:owner/:repo/pulls",
			"GET  /api/v1/repos/:owner/:repo/issues",
			"POST /api/v1/repos/:owner/:repo/issues",
		},
	})
}

// ── JSON helpers ──────────────────────────────────────────────────────────

func respondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	_ = enc.Encode(data)
}

func respondError(w http.ResponseWriter, status int, code, detail string) {
	respondJSON(w, status, map[string]string{
		"error":  code,
		"detail": detail,
	})
}
