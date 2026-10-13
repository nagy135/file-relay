package main

import (
	"bytes"
	"io/fs"
	"net/http/httptest"
	"path"
	"regexp"
	"strings"
	"testing"
)

func TestEmbeddedAssetsAndAuthentication(t *testing.T) {
	a := testRelay(t)
	a.username, a.password = "admin", "secret"
	err := fs.WalkDir(webContent, "web/assets", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		body, err := webContent.ReadFile(name)
		if err != nil {
			return err
		}
		endpoint := "/" + strings.TrimPrefix(name, "web/")
		for _, authenticated := range []bool{false, true} {
			r := httptest.NewRequest("GET", endpoint, nil)
			if authenticated {
				r.SetBasicAuth("admin", "secret")
			}
			w := httptest.NewRecorder()
			a.handler().ServeHTTP(w, r)
			if strings.HasPrefix(endpoint, "/assets/dashboard/") && !authenticated {
				if w.Code != 401 {
					t.Fatalf("private module %s exposed: %d", endpoint, w.Code)
				}
				continue
			}
			if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), body) {
				t.Fatalf("asset %s: %d, incorrect content", endpoint, w.Code)
			}
			wantType := "text/javascript"
			if path.Ext(name) == ".css" {
				wantType = "text/css"
			}
			if !strings.HasPrefix(w.Header().Get("Content-Type"), wantType) {
				t.Fatalf("asset %s has incorrect MIME type: %s", endpoint, w.Header().Get("Content-Type"))
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, endpoint := range []string{"/assets/", "/assets/shared/", "/assets/missing.js", "/assets/metadata.json"} {
		w := httptest.NewRecorder()
		a.handler().ServeHTTP(w, httptest.NewRequest("GET", endpoint, nil))
		if w.Code != 404 {
			t.Fatalf("unexpected asset/listing %s: %d", endpoint, w.Code)
		}
	}
}

func TestEveryEmbeddedModuleImportResolves(t *testing.T) {
	imports := regexp.MustCompile(`(?:from\s+|import\s*)["'](\.[^"']+)["']`)
	err := fs.WalkDir(webContent, "web", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() || path.Ext(name) != ".js" {
			return nil
		}
		body, err := webContent.ReadFile(name)
		if err != nil {
			return err
		}
		for _, match := range imports.FindAllSubmatch(body, -1) {
			dependency := path.Clean(path.Join(path.Dir(name), string(match[1])))
			if _, err := webContent.ReadFile(dependency); err != nil {
				t.Errorf("%s imports missing module %s: %v", name, dependency, err)
			}
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
