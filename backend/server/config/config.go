package config

import (
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the Dragyou server.
type Config struct {
	// Server
	Port string
	Env  string

	// Database (PostgreSQL)
	DatabaseURL string
	DBHost      string
	DBPort      string
	DBUser      string
	DBPassword  string
	DBName      string
	DBSSLMode   string

	// JWT
	JWTSecret            string
	JWTExpiryMinutes     int
	JWTRefreshExpiryDays int

	// Repository storage path (local disk for Phase 1)
	RepoStoragePath string

	// Drag CLI binary path (used by the engine bridge)
	DragBin string
	NovaBin string

	// Rate limiting (requests per minute)
	RateLimitAnon  int
	RateLimitAuthed int

	// CORS
	AllowedOrigins []string
}

// DSN returns a PostgreSQL connection string.
// prefer_simple_protocol=true disables pgx named-prepared-statement caching,
// which prevents "prepared statement already exists" (SQLSTATE 42P05) errors
// on Render / PgBouncer-backed databases where connections are reused across
// process restarts without a clean session teardown.
func (c *Config) DSN() string {
	if c.DatabaseURL != "" {
		// Safely append prefer_simple_protocol using proper URL query handling
		// so we use & instead of ? when query params already exist.
		if !strings.Contains(c.DatabaseURL, "prefer_simple_protocol") {
			u, err := url.Parse(c.DatabaseURL)
			if err == nil {
				q := u.Query()
				q.Set("prefer_simple_protocol", "true")
				u.RawQuery = q.Encode()
				return u.String()
			}
			// Fallback if parsing fails: return as-is
		}
		return c.DatabaseURL
	}
	return "host=" + c.DBHost +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" port=" + c.DBPort +
		" sslmode=" + c.DBSSLMode +
		" TimeZone=UTC" +
		" prefer_simple_protocol=true"
}

// Load reads configuration from environment variables (and optionally .env).
func Load() *Config {
	// Load .env if present (development convenience)
	if err := godotenv.Load(); err != nil {
		// Not fatal — prod uses real env vars
		log.Println("config: no .env file found, using environment variables")
	}

	cfg := &Config{
		Port:            getEnv("PORT", "8080"),
		Env:             getEnv("ENV", "development"),
		DatabaseURL:     getEnv("DATABASE_URL", ""),
		DBHost:          getEnv("DB_HOST", "localhost"),
		DBPort:          getEnv("DB_PORT", "5432"),
		DBUser:          getEnv("DB_USER", "dragyou"),
		DBPassword:      getEnv("DB_PASSWORD", "dragyou"),
		DBName:          getEnv("DB_NAME", "dragyou"),
		DBSSLMode:       getEnv("DB_SSLMODE", "disable"),
		JWTSecret:       getEnv("JWT_SECRET", "change-me-in-production-use-32+chars"),
		JWTExpiryMinutes:     getEnvInt("JWT_EXPIRY_MINUTES", 43200), // 30 days default for web app sessions
		JWTRefreshExpiryDays: getEnvInt("JWT_REFRESH_EXPIRY_DAYS", 90),
		RepoStoragePath: getEnv("REPO_STORAGE_PATH", "./repos"),
		DragBin:         getEnv("DRAG_BIN", getEnv("NOVA_BIN", "")),
		NovaBin:         getEnv("NOVA_BIN", getEnv("DRAG_BIN", "")),
		RateLimitAnon:   getEnvInt("RATE_LIMIT_ANON", 100),
		RateLimitAuthed: getEnvInt("RATE_LIMIT_AUTHED", 1000),
		AllowedOrigins:  parseCORSOrigins(getEnv("CORS_ORIGIN", "http://localhost:3000")),
	}

	if cfg.JWTSecret == "change-me-in-production-use-32+chars" && cfg.Env == "production" {
		log.Fatal("config: JWT_SECRET must be set in production")
	}

	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

// parseCORSOrigins splits a comma-separated list of allowed origins.
// Example env var value:
//
//	CORS_ORIGIN=https://dragyou-mauve.vercel.app,http://localhost:3000
func parseCORSOrigins(raw string) []string {
	parts := strings.Split(raw, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		if o := strings.TrimSpace(p); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
