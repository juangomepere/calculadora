package main

import (
	"reflect"
	"testing"
)

func TestGetenv(t *testing.T) {
	t.Setenv("FOO", "bar")
	if got := getenv("FOO", "fallback"); got != "bar" {
		t.Fatalf("getenv set = %q, want bar", got)
	}
	if got := getenv("MISSING_VAR_XYZ", "fallback"); got != "fallback" {
		t.Fatalf("getenv missing = %q, want fallback", got)
	}
}

func TestParseOrigins(t *testing.T) {
	tests := []struct {
		in   string
		want []string
	}{
		{"http://a.test, http://b.test", []string{"http://a.test", "http://b.test"}},
		{"*", []string{"*"}},
		{"  ", []string{"*"}},
		{"", []string{"*"}},
		{"http://a.test,,", []string{"http://a.test"}},
	}
	for _, tt := range tests {
		if got := parseOrigins(tt.in); !reflect.DeepEqual(got, tt.want) {
			t.Fatalf("parseOrigins(%q) = %v, want %v", tt.in, got, tt.want)
		}
	}
}
