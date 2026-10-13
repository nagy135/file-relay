package main

import (
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

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
