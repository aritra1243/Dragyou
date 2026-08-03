package models

import (
	"time"

	"gorm.io/gorm"
)

// Visibility controls who can see a repository.
type Visibility string

const (
	VisibilityPublic   Visibility = "public"
	VisibilityPrivate  Visibility = "private"
	VisibilityInternal Visibility = "internal" // org members only
)

// Repository represents a Dragyou VCS repository.
type Repository struct {
	ID            uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	OwnerID       uint           `gorm:"not null;index" json:"owner_id"`
	Owner         User           `gorm:"foreignKey:OwnerID" json:"owner,omitempty"`
	Name          string         `gorm:"size:255;not null" json:"name"`
	FullName      string         `gorm:"size:512;uniqueIndex;not null" json:"full_name"` // "owner/repo"
	Description   string         `gorm:"size:512" json:"description,omitempty"`
	Visibility    Visibility     `gorm:"size:16;default:'private';not null" json:"visibility"`
	DefaultBranch string         `gorm:"size:255;default:'main'" json:"default_branch"`
	StoragePath   string         `gorm:"size:1024" json:"-"` // path on disk (not exposed)
	IsFork        bool           `gorm:"default:false" json:"is_fork"`
	ForkedFromID  *uint          `json:"forked_from_id,omitempty"`
	IsArchived    bool           `gorm:"default:false" json:"is_archived"`
	IsTemplate    bool           `gorm:"default:false" json:"is_template"`
	StarCount     int            `gorm:"default:0" json:"star_count"`
	ForkCount     int            `gorm:"default:0" json:"fork_count"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// RepositoryMember tracks per-user access to a repo.
type RepoRole string

const (
	RoleOwner      RepoRole = "owner"
	RoleAdmin      RepoRole = "admin"
	RoleMaintainer RepoRole = "maintainer"
	RoleWrite      RepoRole = "write"
	RoleRead       RepoRole = "read"
)

type RepositoryMember struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RepositoryID uint      `gorm:"not null;index:idx_repo_member,unique" json:"repository_id"`
	UserID       uint      `gorm:"not null;index:idx_repo_member,unique" json:"user_id"`
	User         User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Role         RepoRole  `gorm:"size:32;not null" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
}

// PullRequest models a merge/pull request between two branches.
type PRState string

const (
	PROpen   PRState = "open"
	PRClosed PRState = "closed"
	PRMerged PRState = "merged"
)

type PullRequest struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RepositoryID   uint      `gorm:"not null;index" json:"repository_id"`
	AuthorID       uint      `gorm:"not null;index" json:"author_id"`
	Author         User      `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Title          string    `gorm:"size:512;not null" json:"title"`
	Body           string    `gorm:"type:text" json:"body,omitempty"`
	State          PRState   `gorm:"size:16;default:'open';not null" json:"state"`
	SourceBranch   string    `gorm:"size:255;not null" json:"source_branch"`
	TargetBranch   string    `gorm:"size:255;not null" json:"target_branch"`
	HeadCommit     string    `gorm:"size:64" json:"head_commit,omitempty"`
	BaseCommit     string    `gorm:"size:64" json:"base_commit,omitempty"`
	MergeCommit    string    `gorm:"size:64" json:"merge_commit,omitempty"`
	MergedByID     *uint     `json:"merged_by_id,omitempty"`
	IsDraft        bool      `gorm:"default:false" json:"is_draft"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	MergedAt       *time.Time `json:"merged_at,omitempty"`
	ClosedAt       *time.Time `json:"closed_at,omitempty"`
}

// PRReview holds a review on a pull request.
type PRReviewState string

const (
	PRReviewPending   PRReviewState = "pending"
	PRReviewApproved  PRReviewState = "approved"
	PRReviewRejected  PRReviewState = "rejected"
	PRReviewComment   PRReviewState = "comment"
)

type PRReview struct {
	ID            uint          `gorm:"primaryKey;autoIncrement" json:"id"`
	PullRequestID uint          `gorm:"not null;index" json:"pull_request_id"`
	ReviewerID    uint          `gorm:"not null;index" json:"reviewer_id"`
	Reviewer      User          `gorm:"foreignKey:ReviewerID" json:"reviewer,omitempty"`
	State         PRReviewState `gorm:"size:16;not null" json:"state"`
	Body          string        `gorm:"type:text" json:"body,omitempty"`
	CreatedAt     time.Time     `json:"created_at"`
}

// Issue tracks bugs, features, and tasks.
type IssueState string

const (
	IssueOpen   IssueState = "open"
	IssueClosed IssueState = "closed"
)

type Issue struct {
	ID           uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	RepositoryID uint       `gorm:"not null;index" json:"repository_id"`
	AuthorID     uint       `gorm:"not null;index" json:"author_id"`
	Author       User       `gorm:"foreignKey:AuthorID" json:"author,omitempty"`
	Number       int        `gorm:"not null" json:"number"` // per-repo issue number
	Title        string     `gorm:"size:512;not null" json:"title"`
	Body         string     `gorm:"type:text" json:"body,omitempty"`
	State        IssueState `gorm:"size:16;default:'open'" json:"state"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	ClosedAt     *time.Time `json:"closed_at,omitempty"`
}

// Webhook sends HTTP POST notifications on events.
type Webhook struct {
	ID           uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RepositoryID uint      `gorm:"not null;index" json:"repository_id"`
	URL          string    `gorm:"size:1024;not null" json:"url"`
	Secret       string    `gorm:"size:255" json:"-"`
	Events       string    `gorm:"size:512" json:"events"` // comma-separated: push,pr,issue
	IsActive     bool      `gorm:"default:true" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}
