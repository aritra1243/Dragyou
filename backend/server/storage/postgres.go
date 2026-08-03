package storage

import (
	"fmt"
	"log"
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
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	db, err := gorm.Open(postgres.Open(cfg.DSN()), gormCfg)
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
func AutoMigrate(db *gorm.DB) error {
	log.Println("storage: running auto-migration...")

	err := db.AutoMigrate(
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
		return fmt.Errorf("auto-migrate: %w", err)
	}

	log.Println("storage: migration complete")
	return nil
}
