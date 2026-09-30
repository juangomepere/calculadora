package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newServer() http.Handler {
	return NewHandler().Routes()
}

func TestCalculateSuccess(t *testing.T) {
	body := `{"operation":"add","operands":[2,3]}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(body))
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body: %s", rec.Code, rec.Body.String())
	}
	var resp calcResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if resp.Operation != "add" || resp.Result != 5 || len(resp.Operands) != 2 {
		t.Fatalf("unexpected response: %+v", resp)
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		wantStatus int
		wantCode   string
	}{
		{"division by zero", `{"operation":"divide","operands":[1,0]}`, http.StatusBadRequest, "DIVISION_BY_ZERO"},
		{"negative sqrt", `{"operation":"sqrt","operands":[-4]}`, http.StatusBadRequest, "NEGATIVE_SQRT"},
		{"non finite", `{"operation":"power","operands":[10,400]}`, http.StatusBadRequest, "NON_FINITE_RESULT"},
		{"unknown operation", `{"operation":"modulo","operands":[1,2]}`, http.StatusBadRequest, "UNKNOWN_OPERATION"},
		{"too few operands", `{"operation":"add","operands":[1]}`, http.StatusBadRequest, "INVALID_OPERAND_COUNT"},
		{"too many operands", `{"operation":"add","operands":[1,2,3]}`, http.StatusBadRequest, "INVALID_OPERAND_COUNT"},
		{"malformed json", `{"operation":`, http.StatusBadRequest, "INVALID_JSON"},
		{"empty body", ``, http.StatusBadRequest, "INVALID_JSON"},
		{"non numeric operand", `{"operation":"add","operands":["a",3]}`, http.StatusBadRequest, "INVALID_JSON"},
		{"unknown field", `{"operation":"add","operands":[1,2],"extra":true}`, http.StatusBadRequest, "INVALID_JSON"},
		{"trailing data", `{"operation":"add","operands":[1,2]}{}`, http.StatusBadRequest, "INVALID_JSON"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(tt.body))
			rec := httptest.NewRecorder()
			newServer().ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d; body: %s", rec.Code, tt.wantStatus, rec.Body.String())
			}
			var resp errorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decode error response: %v", err)
			}
			if resp.Error.Code != tt.wantCode {
				t.Fatalf("error code = %q, want %q", resp.Error.Code, tt.wantCode)
			}
			if resp.Error.Message == "" {
				t.Fatal("error message is empty")
			}
		})
	}
}

func TestCalculateBodyTooLarge(t *testing.T) {
	// Build an operands array larger than maxBodyBytes.
	var sb strings.Builder
	sb.WriteString(`{"operation":"add","operands":[`)
	for i := 0; i < 800000; i++ { // ~1.6 MiB, over the 1 MiB cap
		sb.WriteString("1,")
	}
	sb.WriteString("1]}")

	req := httptest.NewRequest(http.MethodPost, "/api/v1/calculate", strings.NewReader(sb.String()))
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
	var resp errorResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &resp)
	if resp.Error.Code != "PAYLOAD_TOO_LARGE" {
		t.Fatalf("error code = %q, want PAYLOAD_TOO_LARGE", resp.Error.Code)
	}
}

func TestMethodNotAllowed(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/calculate", nil)
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", rec.Code)
	}
}

func TestOperations(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/operations", nil)
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	var resp struct {
		Operations []struct {
			Operation string `json:"operation"`
			Arity     int    `json:"arity"`
		} `json:"operations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(resp.Operations) != 7 {
		t.Fatalf("got %d operations, want 7", len(resp.Operations))
	}
}

func TestHealthz(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	newServer().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), `"status":"ok"`) {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
}
