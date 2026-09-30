package api

import (
	"errors"
	"net/http"
	"testing"
)

func TestMapDomainErrorUnknownIsInternal(t *testing.T) {
	// An error that is not a known sentinel must collapse to a generic 500 and
	// must not leak the underlying message.
	e := mapDomainError(errors.New("some internal detail"))
	if e.status != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", e.status)
	}
	if e.code != "INTERNAL_ERROR" {
		t.Fatalf("code = %q, want INTERNAL_ERROR", e.code)
	}
	if e.message == "some internal detail" {
		t.Fatal("internal error message leaked to client")
	}
}
