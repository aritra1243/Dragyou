package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// ContextKey is the type for context keys to avoid collisions.
type ContextKey string

const (
	ContextUserID   ContextKey = "user_id"
	ContextUsername ContextKey = "username"
	ContextIsAdmin  ContextKey = "is_admin"
)

// Claims defines the JWT payload.
type Claims struct {
	UserID   uint   `json:"uid"`
	Username string `json:"sub"`
	IsAdmin  bool   `json:"adm"`
	jwt.RegisteredClaims
}

// Auth returns a middleware that validates JWT Bearer tokens.
// Requests without a valid token are rejected with 401.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}
			token, err := extractAndValidateJWT(r, jwtSecret)
			if err != nil {
				http.Error(w, `{"error":"unauthorized","detail":"`+err.Error()+`"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(*Claims)
			if !ok || !token.Valid {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ContextUserID, claims.UserID)
			ctx = context.WithValue(ctx, ContextUsername, claims.Username)
			ctx = context.WithValue(ctx, ContextIsAdmin, claims.IsAdmin)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// OptionalAuth validates the JWT if present, but does not reject if absent.
// Useful for endpoints that behave differently for authenticated vs anonymous users.
func OptionalAuth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token, err := extractAndValidateJWT(r, jwtSecret)
			if err == nil {
				if claims, ok := token.Claims.(*Claims); ok && token.Valid {
					ctx := context.WithValue(r.Context(), ContextUserID, claims.UserID)
					ctx = context.WithValue(ctx, ContextUsername, claims.Username)
					ctx = context.WithValue(ctx, ContextIsAdmin, claims.IsAdmin)
					r = r.WithContext(ctx)
				}
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin rejects non-admin users with 403.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		isAdmin, _ := r.Context().Value(ContextIsAdmin).(bool)
		if !isAdmin {
			http.Error(w, `{"error":"forbidden","detail":"admin access required"}`, http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetUserID extracts the authenticated user ID from the request context.
// Returns 0 if not authenticated.
func GetUserID(r *http.Request) uint {
	uid, _ := r.Context().Value(ContextUserID).(uint)
	return uid
}

// GetUsername extracts the authenticated username from the request context.
func GetUsername(r *http.Request) string {
	u, _ := r.Context().Value(ContextUsername).(string)
	return u
}

// ─── internal ─────────────────────────────────────────────────────────────────

func extractAndValidateJWT(r *http.Request, secret string) (*jwt.Token, error) {
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		return nil, jwt.ErrTokenMalformed
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return nil, jwt.ErrTokenMalformed
	}

	tokenStr := parts[1]
	return jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
}
