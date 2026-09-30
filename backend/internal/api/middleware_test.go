package api

import (
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestRecovery(t *testing.T) {
	panicky := http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
		panic("boom")
	})
	h := Chain(panicky, Recovery(discardLogger()))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestLogging(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	h := Chain(ok, Logging(discardLogger()))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusTeapot {
		t.Fatalf("status = %d, want 418", rec.Code)
	}
}

func TestCORS(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })

	tests := []struct {
		name       string
		allowed    []string
		origin     string
		method     string
		wantOrigin string
		wantStatus int
	}{
		{"allowed origin", []string{"http://localhost:3000"}, "http://localhost:3000", http.MethodGet, "http://localhost:3000", http.StatusOK},
		{"wildcard", []string{"*"}, "http://anything.test", http.MethodGet, "*", http.StatusOK},
		{"disallowed origin", []string{"http://localhost:3000"}, "http://evil.test", http.MethodGet, "", http.StatusOK},
		{"preflight", []string{"*"}, "http://anything.test", http.MethodOptions, "*", http.StatusNoContent},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			h := Chain(next, CORS(tt.allowed))
			req := httptest.NewRequest(tt.method, "/api/v1/operations", nil)
			req.Header.Set("Origin", tt.origin)
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rec.Code, tt.wantStatus)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantOrigin {
				t.Fatalf("Allow-Origin = %q, want %q", got, tt.wantOrigin)
			}
		})
	}
}
