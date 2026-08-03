package middleware

import (
	"net/http"
	"sync"
	"time"
)

// tokenBucket implements an in-memory per-IP token bucket rate limiter.
// For production use, replace with a Redis-backed implementation (Phase 8).
type tokenBucket struct {
	tokens     float64
	maxTokens  float64
	refillRate float64 // tokens per second
	lastRefill time.Time
	mu         sync.Mutex
}

func (b *tokenBucket) allow() bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(b.lastRefill).Seconds()
	b.tokens += elapsed * b.refillRate
	if b.tokens > b.maxTokens {
		b.tokens = b.maxTokens
	}
	b.lastRefill = now

	if b.tokens >= 1 {
		b.tokens--
		return true
	}
	return false
}

// limiterStore manages per-IP buckets.
type limiterStore struct {
	mu      sync.RWMutex
	buckets map[string]*tokenBucket
	// cleanup goroutine will evict idle entries
	maxTokens  float64
	refillRate float64
}

func newLimiterStore(maxTokens, refillRate float64) *limiterStore {
	ls := &limiterStore{
		buckets:    make(map[string]*tokenBucket),
		maxTokens:  maxTokens,
		refillRate: refillRate,
	}
	go ls.cleanup()
	return ls
}

func (ls *limiterStore) get(ip string) *tokenBucket {
	ls.mu.RLock()
	b, ok := ls.buckets[ip]
	ls.mu.RUnlock()
	if ok {
		return b
	}

	ls.mu.Lock()
	defer ls.mu.Unlock()
	// Double-check
	if b, ok = ls.buckets[ip]; ok {
		return b
	}
	b = &tokenBucket{
		tokens:     ls.maxTokens,
		maxTokens:  ls.maxTokens,
		refillRate: ls.refillRate,
		lastRefill: time.Now(),
	}
	ls.buckets[ip] = b
	return b
}

func (ls *limiterStore) cleanup() {
	ticker := time.NewTicker(5 * time.Minute)
	for range ticker.C {
		ls.mu.Lock()
		now := time.Now()
		for ip, b := range ls.buckets {
			b.mu.Lock()
			idle := now.Sub(b.lastRefill) > 10*time.Minute
			b.mu.Unlock()
			if idle {
				delete(ls.buckets, ip)
			}
		}
		ls.mu.Unlock()
	}
}

// RateLimit returns a middleware that applies token-bucket rate limiting per client IP.
// anonRPM and authedRPM are requests-per-minute limits.
func RateLimit(anonRPM, authedRPM int) func(http.Handler) http.Handler {
	// requests per second = RPM / 60
	anonStore   := newLimiterStore(float64(anonRPM),   float64(anonRPM)/60.0)
	authedStore := newLimiterStore(float64(authedRPM), float64(authedRPM)/60.0)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid := GetUserID(r)
			ip  := clientIP(r)

			var allowed bool
			if uid == 0 {
				allowed = anonStore.get(ip).allow()
			} else {
				allowed = authedStore.get(ip).allow()
			}

			if !allowed {
				w.Header().Set("Retry-After", "1")
				http.Error(w, `{"error":"rate_limit_exceeded","detail":"too many requests"}`,
					http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func clientIP(r *http.Request) string {
	// Prefer X-Forwarded-For (set by load balancer / NGINX)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		return xff
	}
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}
	return r.RemoteAddr
}
