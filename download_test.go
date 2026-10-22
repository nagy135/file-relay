package main

import (
	"bytes"
	"html"
	"mime"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestBrowserDownloadPageAndDirectClients(t *testing.T) {
	a := testRelay(t)
	_, path := uploadFile(t, a, "app.ipa", "package bytes")
	for _, tc := range []struct {
		name, method, query, accept, rangeHeader string
		wantPage                                 bool
	}{
		{"Safari navigation", "GET", "", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "", true},
		{"Chrome navigation", "GET", "", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8", "", true},
		{"page HEAD", "HEAD", "", "text/html", "", true},
		{"curl", "GET", "", "*/*", "", false},
		{"no accept", "GET", "", "", "", false},
		{"excluded HTML", "GET", "", "text/html;q=0,*/*", "", false},
		{"malformed HTML preference", "GET", "", "text/html;q=invalid", "", false},
		{"direct query", "GET", "?download=1", "text/html", "", false},
		{"resume existing URL", "GET", "", "text/html", "bytes=0-6", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest(tc.method, path+tc.query, nil)
			r.Header.Set("Accept", tc.accept)
			r.Header.Set("Range", tc.rangeHeader)
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, r)
			status := http.StatusOK
			if tc.rangeHeader != "" {
				status = http.StatusPartialContent
			}
			if w.Code != status || w.Header().Get("Vary") != "Accept" {
				t.Fatalf("response: %d %v", w.Code, w.Header())
			}
			if tc.wantPage {
				if w.Header().Get("Content-Type") != "text/html; charset=utf-8" || w.Header().Get("Content-Disposition") != "" {
					t.Fatalf("not an HTML page: %v", w.Header())
				}
				if tc.method == "HEAD" {
					if w.Body.Len() != 0 || w.Header().Get("Content-Length") == "0" {
						t.Fatal("HEAD must describe the page without sending its body")
					}
				} else if !strings.Contains(w.Body.String(), `href="/download`+path+`/app.ipa" download="app.ipa"`) || !strings.Contains(w.Body.String(), "Save as ZIP") {
					t.Fatalf("missing download actions: %s", w.Body.String())
				}
			} else {
				want := "package bytes"
				if tc.rangeHeader != "" {
					want = "package"
				}
				if w.Body.String() != want || w.Header().Get("Content-Type") != "application/octet-stream" || !strings.HasPrefix(w.Header().Get("Content-Disposition"), "attachment;") {
					t.Fatalf("broken direct download: %v %q", w.Header(), w.Body.String())
				}
			}
		})
	}
}

func TestNamedDownloadsAndIPAZipFallback(t *testing.T) {
	for _, filename := range []string{"app.ipa", "APP.IPA", "résumé #1.ipa", "report.pdf", "<script>&\".zip"} {
		t.Run(filename, func(t *testing.T) {
			a := testRelay(t)
			_, path := uploadFile(t, a, filename, "package bytes")
			r := httptest.NewRequest("GET", path, nil)
			r.Header.Set("Accept", "text/html")
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, r)
			if w.Code != 200 || !strings.Contains(w.Body.String(), html.EscapeString(filename)) || strings.Contains(w.Body.String(), "<script>") {
				t.Fatalf("unsafe or missing filename: %d %s", w.Code, w.Body.String())
			}
			links := regexp.MustCompile(`href="(/download/[^"]+)"`).FindAllStringSubmatch(w.Body.String(), -1)
			wantLinks := 1
			if strings.EqualFold(filepath.Ext(filename), ".ipa") {
				wantLinks = 2
			}
			if len(links) != wantLinks {
				t.Fatalf("expected %d download links, got %v", wantLinks, links)
			}
			for i, link := range links {
				wantFilename := filename
				if i == 1 {
					wantFilename += ".zip"
				}
				for _, method := range []string{"GET", "HEAD"} {
					r := httptest.NewRequest(method, html.UnescapeString(link[1]), nil)
					r.Header.Set("Accept", "text/html")
					if method == "GET" {
						r.Header.Set("Range", "bytes=0-6")
					}
					w := httptest.NewRecorder()
					a.handler().ServeHTTP(w, r)
					kind, params, err := mime.ParseMediaType(w.Header().Get("Content-Disposition"))
					if err != nil || kind != "attachment" || params["filename"] != wantFilename || w.Header().Get("Content-Type") != "application/octet-stream" {
						t.Fatalf("bad attachment: %d %v %v", w.Code, w.Header(), err)
					}
					if method == "GET" && (w.Code != 206 || w.Body.String() != "package" || w.Header().Get("Content-Range") != "bytes 0-6/13") {
						t.Fatalf("broken range: %d %v %q", w.Code, w.Header(), w.Body.String())
					}
					if method == "HEAD" && (w.Code != 200 || w.Body.Len() != 0 || w.Header().Get("Content-Length") != "13") {
						t.Fatalf("broken HEAD: %d %v %q", w.Code, w.Header(), w.Body.String())
					}
				}
				// The ZIP alternative changes only the name, never the bytes.
				w := httptest.NewRecorder()
				a.handler().ServeHTTP(w, httptest.NewRequest("GET", html.UnescapeString(link[1]), nil))
				if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), []byte("package bytes")) {
					t.Fatalf("changed download content: %d %q", w.Code, w.Body.String())
				}
			}
			for _, name := range []string{"other.ipa", filename + ".exe", filename + ".zip.zip"} {
				w := httptest.NewRecorder()
				a.handler().ServeHTTP(w, httptest.NewRequest("GET", "/download"+path+"/"+url.PathEscape(name), nil))
				if w.Code != 404 {
					t.Fatalf("unexpected name accepted: %s (%d)", name, w.Code)
				}
			}
		})
	}
}

func TestDownloadPageAndNamedURLCheckExpiryAndStorage(t *testing.T) {
	for _, missing := range []bool{false, true} {
		a := testRelay(t)
		_, path := uploadFile(t, a, "app.ipa", "package bytes")
		if missing {
			if err := os.Remove(filepath.Join(a.dir, strings.TrimPrefix(path, "/"), "content")); err != nil {
				t.Fatal(err)
			}
		} else {
			now := a.now().Add(time.Hour)
			a.now = func() time.Time { return now }
		}
		for _, endpoint := range []string{path, "/download" + path + "/app.ipa", "/download" + path + "/app.ipa.zip"} {
			r := httptest.NewRequest("GET", endpoint, nil)
			r.Header.Set("Accept", "text/html")
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, r)
			if w.Code != 404 || strings.Contains(w.Body.String(), "app.ipa") {
				t.Fatalf("unavailable file exposed: %d %s", w.Code, w.Body.String())
			}
		}
	}
}

func TestAttachmentFilenameFallback(t *testing.T) {
	for _, filename := range []string{"app.ipa", "résumé.ipa", "应用 📦.ipa", `name "quoted"; test.ipa`, `notes filename*=UTF-8''test.ipa`} {
		header := attachmentDisposition(filename)
		kind, params, err := mime.ParseMediaType(header)
		if err != nil || kind != "attachment" || params["filename"] != filename {
			t.Fatalf("lost original filename %q: %s (%v)", filename, header, err)
		}
		for _, r := range header {
			if r < 32 || r > 126 {
				t.Fatalf("non-ASCII or control character in header: %q", header)
			}
		}
		fallbackOnly := strings.Split(header, "; filename*=")[0]
		_, fallback, err := mime.ParseMediaType(fallbackOnly)
		if err != nil || !strings.HasSuffix(fallback["filename"], ".ipa") {
			t.Fatalf("missing compatible filename: %q (%v)", fallbackOnly, err)
		}
	}
}

func TestDownloadPageContentLength(t *testing.T) {
	a := testRelay(t)
	_, path := uploadFile(t, a, "app.ipa", "package bytes")
	r := httptest.NewRequest("GET", path, nil)
	r.Header.Set("Accept", "text/html")
	w := httptest.NewRecorder()
	a.handler().ServeHTTP(w, r)
	if w.Header().Get("Content-Length") != strconv.Itoa(w.Body.Len()) {
		t.Fatalf("incorrect page length: %v (%d bytes)", w.Header(), w.Body.Len())
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
