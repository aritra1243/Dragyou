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

	if err := storage.AutoMigrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// ── Build HTTP router ─────────────────────────────────────────────────
	r := api.NewRouter(cfg, db)

	// ── Start server ──────────────────────────────────────────────────────
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
