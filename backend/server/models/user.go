package models

import (
	"time"

	"gorm.io/gorm"
)

// User represents a Dragyou platform user.
type User struct {
	ID           uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Username     string         `gorm:"uniqueIndex;size:64;not null" json:"username"`
	Email        string         `gorm:"uniqueIndex;size:255;not null" json:"email"`
	PasswordHash string         `gorm:"size:255;not null" json:"-"` // never expose
	DisplayName  string         `gorm:"size:128" json:"display_name"`
	AvatarURL    string         `gorm:"type:text" json:"avatar_url,omitempty"`
	Bio          string         `gorm:"type:text" json:"bio,omitempty"`
	IsAdmin      bool           `gorm:"default:false" json:"is_admin"`
	IsActive     bool           `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`

	// Associations
	Repositories []Repository `gorm:"foreignKey:OwnerID" json:"-"`
}

// PublicProfile returns a safe public view of the user (no sensitive fields).
type PublicProfile struct {
	ID          uint      `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	Bio         string    `json:"bio,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

func (u *User) ToPublic() PublicProfile {
	return PublicProfile{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		Bio:         u.Bio,
		CreatedAt:   u.CreatedAt,
	}
}

// SSHKey allows a user to authenticate via SSH.
type SSHKey struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"user_id"`
	Title       string    `gorm:"size:128;not null" json:"title"`
	PublicKey   string    `gorm:"type:text;not null" json:"public_key"`
	Fingerprint string    `gorm:"size:128;uniqueIndex" json:"fingerprint"`
	LastUsed    *time.Time `json:"last_used,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// APIToken allows programmatic access without username/password.
type APIToken struct {
	ID          uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint       `gorm:"not null;index" json:"user_id"`
	Name        string     `gorm:"size:128;not null" json:"name"`
	TokenHash   string     `gorm:"size:255;uniqueIndex;not null" json:"-"`
	Prefix      string     `gorm:"size:16" json:"prefix"` // shown to user: "drg_..."
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	LastUsed    *time.Time `json:"last_used,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// AuditEvent records security-relevant actions.
type AuditEvent struct {
	ID         uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID     *uint     `gorm:"index" json:"user_id,omitempty"`
	Action     string    `gorm:"size:128;not null" json:"action"`
	TargetType string    `gorm:"size:64" json:"target_type,omitempty"`
	TargetID   *uint     `json:"target_id,omitempty"`
	IPAddress  string    `gorm:"size:64" json:"ip_address,omitempty"`
	UserAgent  string    `gorm:"size:512" json:"user_agent,omitempty"`
	Metadata   string    `gorm:"type:text" json:"metadata,omitempty"` // JSON blob
	CreatedAt  time.Time `json:"created_at"`
}
