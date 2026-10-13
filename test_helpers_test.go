package main

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
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
