package storage

import (
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/dragyou/server/config"
	"github.com/dragyou/server/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Connect opens a PostgreSQL connection using GORM and returns the *gorm.DB.
func Connect(cfg *config.Config) (*gorm.DB, error) {
	logLevel := logger.Warn
	if cfg.Env == "development" {
		logLevel = logger.Info
	}

	gormCfg := &gorm.Config{
		Logger:      logger.Default.LogMode(logLevel),
		PrepareStmt: false,
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	pgConfig := postgres.Config{
		DSN:                  cfg.DSN(),
		PreferSimpleProtocol: true, // Disables implicit prepared statements for PgBouncer / Connection Poolers
	}

	db, err := gorm.Open(postgres.New(pgConfig), gormCfg)
	if err != nil {
		return nil, fmt.Errorf("connect to postgres: %w", err)
	}

	// Configure connection pool
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)
	sqlDB.SetConnMaxIdleTime(2 * time.Minute)

	log.Println("storage: connected to PostgreSQL")
	return db, nil
}

// AutoMigrate runs GORM's auto-migration for all models.
// In production this should be replaced with a proper migration tool (e.g. golang-migrate).
//
// Note: DisableForeignKeyConstraintWhenMigrating is set so GORM does not emit
// extra ALTER TABLE statements that can race against an existing schema.
// "relation already exists" errors (SQLSTATE 42P07) are treated as a no-op
// warning rather than a fatal error because they indicate the schema is already
// up-to-date from a previous deploy.
func AutoMigrate(db *gorm.DB) error {
	log.Println("storage: running auto-migration...")

	migDB := db.Session(&gorm.Session{})

	err := migDB.AutoMigrate(
		// Core
		&models.User{},
		&models.SSHKey{},
		&models.APIToken{},
		&models.AuditEvent{},

		// Repository
		&models.Repository{},
		&models.RepositoryMember{},

		// Collaboration
		&models.PullRequest{},
		&models.PRReview{},
		&models.Issue{},
		&models.Webhook{},
	)
	if err != nil {
		// "relation already exists" means the schema is already current — not fatal.
		// This can happen on Render when the app process is killed mid-migration and
		// restarted before PostgreSQL rolls back the partial DDL.
		if isAlreadyExistsErr(err) {
			log.Printf("storage: migration skipped (schema already up-to-date): %v", err)
			return nil
		}
		return fmt.Errorf("auto-migrate: %w", err)
	}

	log.Println("storage: migration complete")
	return nil
}

// isAlreadyExistsErr returns true when err is a PostgreSQL "relation already
// exists" error (SQLSTATE 42P07) or a "prepared statement already exists"
// error (SQLSTATE 42P05).
func isAlreadyExistsErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "42P07") || // relation already exists
		strings.Contains(msg, "42P05") || // prepared statement already exists
		strings.Contains(msg, "already exists")
}
