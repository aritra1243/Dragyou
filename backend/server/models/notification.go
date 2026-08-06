package models

import (
	"time"
)

type NotificationType string

const (
	NotificationStar         NotificationType = "star"
	NotificationFork         NotificationType = "fork"
	NotificationCollaborator NotificationType = "collaborator"
	NotificationPush         NotificationType = "push"
	NotificationPR           NotificationType = "pull_request"
	NotificationIssue        NotificationType = "issue"
)

// Notification represents an alert or activity update for a user.
type Notification struct {
	ID           uint             `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID       uint             `gorm:"not null;index" json:"user_id"`       // Target recipient user
	ActorID      uint             `gorm:"not null;index" json:"actor_id"`      // User who performed the action
	Actor        User             `gorm:"foreignKey:ActorID" json:"actor,omitempty"`
	RepositoryID *uint            `gorm:"index" json:"repository_id,omitempty"`
	Repository   *Repository      `gorm:"foreignKey:RepositoryID" json:"repository,omitempty"`
	Type         NotificationType `gorm:"size:32;not null" json:"type"`
	Title        string           `gorm:"size:255;not null" json:"title"`
	Message      string           `gorm:"type:text" json:"message,omitempty"`
	Link         string           `gorm:"size:512" json:"link,omitempty"`
	IsRead       bool             `gorm:"default:false;index" json:"is_read"`
	CreatedAt    time.Time        `json:"created_at"`
}
