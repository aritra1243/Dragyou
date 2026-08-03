package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration for the Dragyou server.
type Config struct {
	// Server
	Port string
	Env  string

	// Database (PostgreSQL)
	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string
	DBSSLMode  string

	// JWT
	JWTSecret            string
	JWTExpiryMinutes     int
	JWTRefreshExpiryDays int

	// Repository storage path (local disk for Phase 1)
	RepoStoragePath string

	// Nova CLI binary path (used by the engine bridge)
	NovaBin string

	// Rate limiting (requests per minute)
	RateLimitAnon  int
	RateLimitAuthed int

	// CORS
	AllowedOrigins []string
}

// DSN returns a PostgreSQL connection string.
func (c *Config) DSN() string {
	return "host=" + c.DBHost +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" port=" + c.DBPort +
		" sslmode=" + c.DBSSLMode +
		" TimeZone=UTC"
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
		DBHost:          getEnv("DB_HOST", "localhost"),
		DBPort:          getEnv("DB_PORT", "5432"),
		DBUser:          getEnv("DB_USER", "dragyou"),
		DBPassword:      getEnv("DB_PASSWORD", "dragyou"),
		DBName:          getEnv("DB_NAME", "dragyou"),
		DBSSLMode:       getEnv("DB_SSLMODE", "disable"),
		JWTSecret:       getEnv("JWT_SECRET", "change-me-in-production-use-32+chars"),
		JWTExpiryMinutes:     getEnvInt("JWT_EXPIRY_MINUTES", 15),
		JWTRefreshExpiryDays: getEnvInt("JWT_REFRESH_EXPIRY_DAYS", 7),
		RepoStoragePath: getEnv("REPO_STORAGE_PATH", "./repos"),
		NovaBin:         getEnv("NOVA_BIN", ""),
		RateLimitAnon:   getEnvInt("RATE_LIMIT_ANON", 100),
		RateLimitAuthed: getEnvInt("RATE_LIMIT_AUTHED", 1000),
		AllowedOrigins:  []string{getEnv("CORS_ORIGIN", "http://localhost:3000")},
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
