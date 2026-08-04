package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/dragyou/server/api"
	"github.com/dragyou/server/config"
	"github.com/dragyou/server/storage"
)

func main() {
	// ── Load configuration ────────────────────────────────────────────────
	cfg := config.Load()

	// ── Connect to database ───────────────────────────────────────────────
	db, err := storage.Connect(cfg)
	if err != nil {
		log.Fatalf("database: %v", err)
	}

	// ── Build HTTP router ─────────────────────────────────────────────────
	r := api.NewRouter(cfg, db)

	// ── Start server FIRST so Render detects the open port immediately ────
	// AutoMigrate can take several seconds on a cold start — if we run it
	// before ListenAndServe, Render times out waiting for a port to open.
	addr := fmt.Sprintf(":%s", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	log.Printf("🚀 Dragyou API server listening on http://localhost%s", addr)
	log.Printf("   Environment : %s", cfg.Env)
	log.Printf("   Database    : %s", cfg.DBName)
	log.Printf("   Repo store  : %s", cfg.RepoStoragePath)

	// ── Run migrations in background after server is up ───────────────────
	go func() {
		if err := storage.AutoMigrate(db); err != nil {
			// Non-fatal: log and continue — schema is likely already current
			// from a previous successful deploy.
			log.Printf("migrate warning: %v", err)
		}
	}()

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server: %v", err)
	}
}

func init() {
	// Ensure repo storage directory exists
	path := os.Getenv("REPO_STORAGE_PATH")
	if path == "" {
		path = "./repos"
	}
	_ = os.MkdirAll(path, 0o755)
}
