package main

import (
	"bytes"
	"encoding/json"
	"mime"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestUploadDownloadAndExpiry(t *testing.T) {
	a := testRelay(t)
	w, path := uploadFile(t, a, "résumé.txt", "hello relay")
	if w.Code != 201 {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	if !uuidPattern.MatchString(strings.TrimPrefix(path, "/")) {
		t.Fatalf("invalid UUID: %q", path)
	}
	var response struct {
		URL string `json:"url"`
		metadata
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.URL != a.baseURL+path || response.Size != 11 || response.Filename != "résumé.txt" || response.ExpiresAt.Sub(response.UploadedAt) != time.Hour {
		t.Fatalf("unexpected response: %+v", response)
	}
	// A new application instance must still be able to read the persisted file.
	restarted := &relay{dir: a.dir, baseURL: a.baseURL, limit: a.limit, now: a.now, uploads: make(chan struct{}, 4)}
	w = httptest.NewRecorder()
	restarted.handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	if w.Code != 200 || w.Body.String() != "hello relay" {
		t.Fatalf("download: %d %q", w.Code, w.Body.String())
	}
	kind, params, err := mime.ParseMediaType(w.Header().Get("Content-Disposition"))
	if err != nil || kind != "attachment" || params["filename"] != "résumé.txt" {
		t.Fatalf("bad attachment header: %v", w.Header())
	}
	if w.Header().Get("Content-Type") != "application/octet-stream" || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatalf("bad download headers: %v", w.Header())
	}
	for _, method := range []string{"GET", "HEAD"} {
		r := httptest.NewRequest(method, path, nil)
		if method == "GET" {
			r.Header.Set("Range", "bytes=0-4")
		}
		w = httptest.NewRecorder()
		a.handler().ServeHTTP(w, r)
		if method == "GET" && (w.Code != 206 || w.Body.String() != "hello") {
			t.Fatalf("range: %d %q", w.Code, w.Body.String())
		}
		if method == "HEAD" && (w.Code != 200 || w.Body.Len() != 0) {
			t.Fatalf("HEAD: %d %q", w.Code, w.Body.String())
		}
	}
	beforeExpiry := response.ExpiresAt.Add(-time.Nanosecond)
	a.now = func() time.Time { return beforeExpiry }
	a.cleanup()
	if _, err := os.Stat(filepath.Join(a.dir, strings.TrimPrefix(path, "/"))); err != nil {
		t.Fatalf("deleted before expiry: %v", err)
	}
	a.now = func() time.Time { return response.ExpiresAt }
	w = httptest.NewRecorder()
	a.handler().ServeHTTP(w, httptest.NewRequest("GET", path, nil))
	if w.Code != 404 {
		t.Fatalf("expired download: %d", w.Code)
	}
	a.cleanup()
	entries, err := os.ReadDir(a.dir)
	if err != nil || len(entries) != 0 {
		t.Fatalf("expired files remain: %v %v", entries, err)
	}
}

func TestUploadBoundaryAndInvalidBodies(t *testing.T) {
	for _, tc := range []struct {
		name             string
		size             int
		extra, truncated bool
		want             int
	}{
		{"empty file", 0, false, false, 201},
		{"exact limit", 16, false, false, 201},
		{"over limit", 17, false, false, 413},
		{"extra field", 4, true, false, 400},
		{"interrupted", 4, false, true, 400},
	} {
		t.Run(tc.name, func(t *testing.T) {
			a := testRelay(t)
			b, contentType := multipartBody(t, "test.txt", strings.Repeat("x", tc.size), tc.extra)
			if tc.truncated {
				b = bytes.NewBuffer(b.Bytes()[:b.Len()-10])
			}
			r := httptest.NewRequest("POST", "/upload", b)
			r.Header.Set("Content-Type", contentType)
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, r)
			if w.Code != tc.want {
				t.Fatalf("status: %d, want %d: %s", w.Code, tc.want, w.Body.String())
			}
			if tc.want != 201 {
				entries, err := os.ReadDir(a.dir)
				if err != nil || len(entries) != 0 {
					t.Fatalf("failed upload left files: %v %v", entries, err)
				}
			}
		})
	}
}

func TestRequestLimitAndBusy(t *testing.T) {
	a := testRelay(t)
	b, contentType := multipartBody(t, "test.txt", "hello", false)
	b.WriteString(strings.Repeat("x", 2<<20))
	r := httptest.NewRequest("POST", "/upload", b)
	r.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("epilogue: %d %s", w.Code, w.Body.String())
	}
	entries, _ := os.ReadDir(a.dir)
	if len(entries) != 0 {
		t.Fatalf("failed request left files: %v", entries)
	}
	for range cap(a.uploads) {
		a.uploads <- struct{}{}
	}
	w, _ = uploadFile(t, a, "test.txt", "hello")
	if w.Code != 503 || w.Header().Get("Retry-After") == "" {
		t.Fatalf("busy: %d %v", w.Code, w.Header())
	}
}
