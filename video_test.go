package main

import (
	"html"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestVideoPlayerAndStream(t *testing.T) {
	a := testRelay(t)
	_, path := uploadFile(t, a, "film & résumé.MP4", "video bytes")
	for _, tc := range []struct {
		query, method, byteRange string
		code                     int
		contentType, body        string
	}{
		{"?play=1", "GET", "", 200, "text/html; charset=utf-8", "<video"},
		{"?play=1", "HEAD", "", 200, "text/html; charset=utf-8", ""},
		{"?play=1&stream=1", "GET", "", 200, "video/mp4", "video bytes"},
		{"?play=1&stream=1", "GET", "bytes=6-10", 206, "video/mp4", "bytes"},
		{"?play=1&stream=1", "GET", "bytes=-5", 206, "video/mp4", "bytes"},
		{"?play=1&stream=1", "HEAD", "", 200, "video/mp4", ""},
		{"?play=1&download=1", "GET", "", 200, "application/octet-stream", "video bytes"},
	} {
		r := httptest.NewRequest(tc.method, path+tc.query, nil)
		r.Header.Set("Accept", "text/html")
		r.Header.Set("Range", tc.byteRange)
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, r)
		if w.Code != tc.code || w.Header().Get("Content-Type") != tc.contentType || !strings.Contains(w.Body.String(), tc.body) {
			t.Fatalf("%+v: %d %v %s", tc, w.Code, w.Header(), w.Body.String())
		}
		if tc.method == "HEAD" && (w.Body.Len() != 0 || w.Header().Get("Content-Length") == "0") {
			t.Fatal("invalid HEAD")
		}
		if tc.contentType == "video/mp4" && !strings.HasPrefix(w.Header().Get("Content-Disposition"), "inline;") {
			t.Fatal("stream must be inline")
		}
		if tc.contentType == "text/html; charset=utf-8" && tc.method == "GET" {
			if !strings.Contains(w.Body.String(), html.EscapeString("film & résumé.MP4")) || !strings.Contains(w.Body.String(), path+"?play=1&amp;stream=1") {
				t.Fatal("missing safe filename or stream URL")
			}
			if !strings.Contains(w.Header().Get("Content-Security-Policy"), "media-src 'self'") {
				t.Fatal("CSP blocks player")
			}
		}
	}
}

func TestVideoAvailabilityAndFormats(t *testing.T) {
	for _, filename := range []string{"a.mp4", "a.WEBM", "a.mov", "a.mkv", "a.avi", "a.ogv", "a.m4v", "a.mpeg", "a.3gp", "a.ts", "a.txt", "a.svg", "a.html"} {
		a := testRelay(t)
		_, path := uploadFile(t, a, filename, "bytes")
		for _, query := range []string{"?play=1", "?play=1&stream=1"} {
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, httptest.NewRequest("GET", path+query, nil))
			want := 200
			if videoContentType(filename) == "" {
				want = 415
			}
			if w.Code != want {
				t.Fatalf("%s: %d", filename, w.Code)
			}
		}
	}
	for _, missing := range []bool{false, true} {
		a := testRelay(t)
		_, path := uploadFile(t, a, "a.mp4", "bytes")
		if missing {
			if err := os.Remove(filepath.Join(a.dir, strings.TrimPrefix(path, "/"), "content")); err != nil {
				t.Fatal(err)
			}
		} else {
			now := a.now().Add(time.Hour)
			a.now = func() time.Time { return now }
		}
		for _, query := range []string{"?play=1", "?play=1&stream=1"} {
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, httptest.NewRequest("GET", path+query, nil))
			if w.Code != 404 {
				t.Fatalf("unavailable video exposed: %d", w.Code)
			}
		}
	}
}
