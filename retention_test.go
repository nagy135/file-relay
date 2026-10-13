package main

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"
)

func uploadWithExpiry(t *testing.T, a *relay, values []string, beforeFile bool) *httptest.ResponseRecorder {
	t.Helper()
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	writeExpiry := func() {
		for _, value := range values {
			if err := mw.WriteField("expires_in", value); err != nil {
				t.Fatal(err)
			}
		}
	}
	if beforeFile {
		writeExpiry()
	}
	part, err := mw.CreateFormFile("file", "test.txt")
	if err != nil {
		t.Fatal(err)
	}
	io.WriteString(part, "hello")
	if !beforeFile {
		writeExpiry()
	}
	if err := mw.Close(); err != nil {
		t.Fatal(err)
	}
	r := httptest.NewRequest(http.MethodPost, "/upload", &body)
	r.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	return w
}

func TestUploadOptionalValidity(t *testing.T) {
	for _, tc := range []struct {
		name   string
		values []string
		want   time.Duration
	}{
		{"default", nil, time.Hour},
		{"minimum", []string{"3600"}, time.Hour},
		{"custom seconds", []string{"3661"}, 3661 * time.Second},
		{"one day", []string{"86400"}, 24 * time.Hour},
		{"one month", []string{"2592000"}, 30 * 24 * time.Hour},
	} {
		for _, before := range []bool{true, false} {
			t.Run(tc.name+map[bool]string{true: "/before", false: "/after"}[before], func(t *testing.T) {
				a := testRelay(t)
				w := uploadWithExpiry(t, a, tc.values, before)
				if w.Code != http.StatusCreated {
					t.Fatalf("upload: %d %s", w.Code, w.Body.String())
				}
				var result metadata
				if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil {
					t.Fatal(err)
				}
				if result.ExpiresAt.Sub(result.UploadedAt) != tc.want {
					t.Fatalf("wrong lifetime: %+v", result)
				}
				id := strings.TrimPrefix(w.Header().Get("Location"), a.baseURL+"/")
				stored, err := a.readMetadata(id)
				if err != nil || !stored.ExpiresAt.Equal(result.ExpiresAt) {
					t.Fatalf("expiry not persisted: %+v, %v", stored, err)
				}
			})
		}
	}
}

func TestInvalidValidityDoesNotPublishFile(t *testing.T) {
	values := []string{"", "3599", "2592001", "0", "-3600", "+3600", "1h", "3600.5", "3.6e3", " 3600", "٣٦٠٠", strings.Repeat("9", 100), "99999999999999999999"}
	for _, value := range values {
		for _, before := range []bool{true, false} {
			t.Run(value+map[bool]string{true: "/before", false: "/after"}[before], func(t *testing.T) {
				a := testRelay(t)
				w := uploadWithExpiry(t, a, []string{value}, before)
				if w.Code != http.StatusBadRequest {
					t.Fatalf("invalid duration accepted: %d %s", w.Code, w.Body.String())
				}
				entries, err := os.ReadDir(a.dir)
				if err != nil || len(entries) != 0 {
					t.Fatalf("rejected upload left files: %v %v", entries, err)
				}
			})
		}
	}
	for _, before := range []bool{true, false} {
		a := testRelay(t)
		w := uploadWithExpiry(t, a, []string{"3600", "86400"}, before)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("duplicate duration accepted: %d %s", w.Code, w.Body.String())
		}
		entries, _ := os.ReadDir(a.dir)
		if len(entries) != 0 {
			t.Fatalf("duplicate expiry left files: %v", entries)
		}
	}
}

func TestCleanupUsesChosenExpiryAfterRestart(t *testing.T) {
	a := testRelay(t)
	uploadFile(t, a, "default.txt", "default")
	w := uploadWithExpiry(t, a, []string{"2592000"}, false)
	id := strings.TrimPrefix(w.Header().Get("Location"), a.baseURL+"/")
	if w.Code != http.StatusCreated {
		t.Fatalf("upload: %d %s", w.Code, w.Body.String())
	}
	start := a.now()
	restarted := &relay{dir: a.dir, now: func() time.Time { return start.Add(time.Hour) }}
	if err := restarted.prepareStorage(); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(a.dir)
	if len(entries) != 1 || entries[0].Name() != id {
		t.Fatalf("cleanup did not preserve long-lived file: %v", entries)
	}
	restarted.now = func() time.Time { return start.Add(30 * 24 * time.Hour) }
	w = httptest.NewRecorder()
	restarted.handler().ServeHTTP(w, httptest.NewRequest("GET", "/"+id, nil))
	if w.Code != http.StatusNotFound {
		t.Fatalf("file accessible at chosen expiry: %d", w.Code)
	}
	restarted.cleanup()
	entries, _ = os.ReadDir(a.dir)
	if len(entries) != 0 {
		t.Fatalf("expired long-lived file remains: %v", entries)
	}
}
