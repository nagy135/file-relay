package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"time"
)

func (a *relay) listFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(a.dir)
	if err != nil {
		fail(w, http.StatusInternalServerError, "could not read file storage")
		return
	}
	now := a.now().UTC()
	files := make([]listedFile, 0)
	for _, entry := range entries {
		if !entry.IsDir() || !uuidPattern.MatchString(entry.Name()) {
			continue
		}
		m, err := a.readMetadata(entry.Name())
		if err != nil || !now.Before(m.ExpiresAt) {
			continue
		}
		// Ignore incomplete entries, including files removed by cleanup during a scan.
		if info, err := os.Stat(filepath.Join(a.dir, entry.Name(), "content")); err != nil || !info.Mode().IsRegular() {
			continue
		}
		files = append(files, listedFile{ID: entry.Name(), URL: a.baseURL + "/" + entry.Name(), metadata: m})
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].UploadedAt.Equal(files[j].UploadedAt) {
			return files[i].ID < files[j].ID
		}
		return files[i].UploadedAt.After(files[j].UploadedAt)
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Files []listedFile `json:"files"`
		Now   time.Time    `json:"now"`
	}{Files: files, Now: now})
}
