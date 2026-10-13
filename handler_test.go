package main

import (
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func TestPublicPagesAndStorageFailure(t *testing.T) {
	a := testRelay(t)
	a.username, a.password = "admin", "secret"
	for path, contentType := range map[string]string{"/": "text/html", "/styles.css": "text/css", "/upload.js": "text/javascript", "/healthz": "text/plain"} {
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 || !strings.HasPrefix(w.Header().Get("Content-Type"), contentType) {
			t.Fatalf("public route %s: %d %v", path, w.Code, w.Header())
		}
	}
	if err := os.RemoveAll(a.dir); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest("GET", "/api/files", nil)
	r.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if w.Code != 500 {
		t.Fatalf("unavailable storage: %d", w.Code)
	}
}
