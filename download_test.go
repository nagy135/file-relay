package main

import (
	"net/http/httptest"
	"os"
	"testing"
)

func TestNoListingOrPaths(t *testing.T) {
	a := testRelay(t)
	uploadFile(t, a, "../../outside.txt", "hello")
	for _, path := range []string{"/data", "/metadata.json", "/no-such-id", "/00000000-0000-4000-8000-000000000000"} {
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 404 {
			t.Fatalf("%s: %d", path, w.Code)
		}
	}
	entries, _ := os.ReadDir(a.dir)
	if len(entries) != 1 {
		t.Fatalf("unexpected entries: %v", entries)
	}
	m, err := a.readMetadata(entries[0].Name())
	if err != nil || m.Filename != "outside.txt" {
		t.Fatalf("filename: %+v %v", m, err)
	}
}
