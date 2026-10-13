package main

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
)

func (a *relay) download(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	m, err := a.readMetadata(id)
	if err != nil || !a.now().Before(m.ExpiresAt) {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(filepath.Join(a.dir, id, "content"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": m.Filename}))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, m.Filename, m.UploadedAt, f)
}
