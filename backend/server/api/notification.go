package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/dragyou/server/middleware"
	"github.com/dragyou/server/models"
)

// NotifyUser creates a persistent notification for a user.
func (h *Handler) NotifyUser(recipientID uint, actorID uint, repoID *uint, nType models.NotificationType, title, message, link string) {
	if recipientID == 0 || actorID == recipientID {
		// Do not notify self
		return
	}

	n := models.Notification{
		UserID:       recipientID,
		ActorID:      actorID,
		RepositoryID: repoID,
		Type:         nType,
		Title:        title,
		Message:      message,
		Link:         link,
		IsRead:       false,
	}

	_ = h.db.Create(&n).Error
}

// GET /api/v1/notifications
func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	unreadOnly := r.URL.Query().Get("unread") == "true"

	q := h.db.Preload("Actor").Preload("Repository").Where("user_id = ?", uid)
	if unreadOnly {
		q = q.Where("is_read = ?", false)
	}

	var unreadCount int64
	h.db.Model(&models.Notification{}).Where("user_id = ? AND is_read = ?", uid, false).Count(&unreadCount)

	var notifications []models.Notification
	if err := q.Order("created_at DESC").Limit(50).Find(&notifications).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Failed to fetch notifications")
		return
	}

	respondJSON(w, http.StatusOK, map[string]any{
		"notifications": notifications,
		"unread_count":  unreadCount,
	})
}

// PUT /api/v1/notifications/{id}/read
func (h *Handler) MarkNotificationRead(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	if err := h.db.Model(&models.Notification{}).
		Where("id = ? AND user_id = ?", id, uid).
		Update("is_read", true).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Failed to update notification")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Notification marked as read"})
}

// PUT /api/v1/notifications/read-all
func (h *Handler) MarkAllNotificationsRead(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	if err := h.db.Model(&models.Notification{}).
		Where("user_id = ? AND is_read = ?", uid, false).
		Update("is_read", true).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Failed to update notifications")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "All notifications marked as read"})
}

// DELETE /api/v1/notifications/{id}
func (h *Handler) DeleteNotification(w http.ResponseWriter, r *http.Request) {
	uid := middleware.GetUserID(r)
	if uid == 0 {
		respondError(w, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	idStr := chi.URLParam(r, "id")
	id, _ := strconv.Atoi(idStr)

	if err := h.db.Where("id = ? AND user_id = ?", id, uid).Delete(&models.Notification{}).Error; err != nil {
		respondError(w, http.StatusInternalServerError, "db_error", "Failed to delete notification")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Notification deleted"})
}
