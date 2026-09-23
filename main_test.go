package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func testRelay(t *testing.T) *relay {
	t.Helper()
	return &relay{dir: t.TempDir(), baseURL: "https://relay.example", limit: 16, now: func() time.Time { return time.Date(2026, 9, 22, 12, 0, 0, 0, time.UTC) }, uploads: make(chan struct{}, 4)}
}

func multipartBody(t *testing.T, filename, content string, extra bool) (*bytes.Buffer, string) {
	t.Helper()
	b := &bytes.Buffer{}
	w := multipart.NewWriter(b)
	p, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatal(err)
	}
	io.WriteString(p, content)
	if extra {
		w.WriteField("extra", "no")
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return b, w.FormDataContentType()
}

func uploadFile(t *testing.T, a *relay, filename, content string) (*httptest.ResponseRecorder, string) {
	t.Helper()
	b, contentType := multipartBody(t, filename, content, false)
	r := httptest.NewRequest("POST", "/upload", b)
	r.Header.Set("Content-Type", contentType)
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	return w, strings.TrimPrefix(w.Header().Get("Location"), a.baseURL)
}

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

func TestDashboardAuthentication(t *testing.T) {
	for _, endpoint := range []string{"/dashboard", "/dashboard.js", "/api/files"} {
		for _, tc := range []struct {
			name, configuredUser, configuredPassword, user, password string
			want                                                     int
		}{
			{"disabled", "", "", "", "", 503},
			{"missing password", "admin", "", "admin", "", 503},
			{"missing username", "", "secret", "", "secret", 503},
			{"anonymous", "admin", "secret", "", "", 401},
			{"wrong username", "admin", "secret", "other", "secret", 401},
			{"wrong password", "admin", "secret", "admin", "wrong", 401},
			{"authenticated", "admin", "secret", "admin", "secret", 200},
		} {
			t.Run(endpoint+"/"+tc.name, func(t *testing.T) {
				a := testRelay(t)
				a.username, a.password = tc.configuredUser, tc.configuredPassword
				r := httptest.NewRequest("GET", endpoint, nil)
				if tc.user != "" || tc.password != "" {
					r.SetBasicAuth(tc.user, tc.password)
				}
				w := httptest.NewRecorder()
				a.handler().ServeHTTP(w, r)
				if w.Code != tc.want {
					t.Fatalf("status %d, want %d", w.Code, tc.want)
				}
				if tc.want == 401 && w.Header().Get("WWW-Authenticate") == "" {
					t.Fatal("missing authentication challenge")
				}
				if w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("dashboard response must not be cached")
				}
				if tc.want != 200 && strings.Contains(w.Body.String(), "File dashboard") {
					t.Fatal("dashboard exposed without authentication")
				}
			})
		}
	}
}

func TestDashboardListsOnlyActiveCompleteFiles(t *testing.T) {
	a := testRelay(t)
	a.username, a.password = "admin", "secret"
	start := a.now()
	_, oldPath := uploadFile(t, a, "expired.txt", "old")
	a.now = func() time.Time { return start.Add(30 * time.Minute) }
	_, earlierPath := uploadFile(t, a, "earlier.txt", "earlier")
	a.now = func() time.Time { return start.Add(40 * time.Minute) }
	_, newerPath := uploadFile(t, a, "<script>.txt", "newer")
	_, incompletePath := uploadFile(t, a, "incomplete.txt", "bad")
	if err := os.Remove(filepath.Join(a.dir, strings.TrimPrefix(incompletePath, "/"), "content")); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(a.dir, ".upload-in-progress"), 0700); err != nil {
		t.Fatal(err)
	}
	// Expired files are excluded at the boundary, even before cleanup removes them.
	a.now = func() time.Time { return start.Add(time.Hour) }
	r := httptest.NewRequest("GET", "/api/files", nil)
	r.SetBasicAuth("admin", "secret")
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("status %d: %s", w.Code, w.Body.String())
	}
	var response struct {
		Files []listedFile `json:"files"`
		Now   time.Time    `json:"now"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if len(response.Files) != 2 {
		t.Fatalf("unexpected files: %+v", response.Files)
	}
	if response.Files[0].ID != strings.TrimPrefix(newerPath, "/") || response.Files[1].ID != strings.TrimPrefix(earlierPath, "/") {
		t.Fatalf("files are not newest first: %+v", response.Files)
	}
	if response.Files[0].Filename != "<script>.txt" || response.Files[0].Size != 5 || response.Files[0].URL != a.baseURL+newerPath || !response.Now.Equal(a.now()) {
		t.Fatalf("incorrect metadata: %+v", response)
	}
	if _, err := os.Stat(filepath.Join(a.dir, strings.TrimPrefix(oldPath, "/"))); err != nil {
		t.Fatal("listing must not remove stored files")
	}
	a.now = func() time.Time { return start.Add(2 * time.Hour) }
	w = httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if !strings.Contains(w.Body.String(), `"files":[]`) {
		t.Fatalf("empty files must be an array: %s", w.Body.String())
	}
}

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
