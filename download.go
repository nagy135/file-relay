package main

import (
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
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
	filename := m.Filename
	if name := r.PathValue("filename"); name != "" {
		if name != filename {
			// An IPA is already a ZIP archive. This alternate name lets users
			// save it without invoking the browser's app-package handling.
			if !strings.EqualFold(filepath.Ext(filename), ".ipa") || name != filename+".zip" {
				http.NotFound(w, r)
				return
			}
			filename = name
		}
	} else {
		w.Header().Add("Vary", "Accept")
		if r.URL.Query().Get("download") != "1" && r.URL.Query().Get("play") != "1" && r.Header.Get("Range") == "" && acceptsHTML(r.Header.Get("Accept")) {
			serveDownloadPage(w, r, id, m)
			return
		}
	}
	if r.URL.Query().Get("play") == "1" && r.URL.Query().Get("download") != "1" {
		contentType := videoContentType(m.Filename)
		if contentType == "" {
			http.Error(w, "This file is not a video", http.StatusUnsupportedMediaType)
			return
		}
		if r.URL.Query().Get("stream") != "1" {
			serveVideoPage(w, r, id, m, a.now())
			return
		}
		w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": filename}))
		w.Header().Set("Content-Type", contentType)
		http.ServeContent(w, r, filename, m.UploadedAt, f)
		return
	}
	w.Header().Set("Content-Disposition", attachmentDisposition(filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, filename, m.UploadedAt, f)
}

func attachmentDisposition(filename string) string {
	disposition := mime.FormatMediaType("attachment", map[string]string{"filename": filename})
	// FormatMediaType emits only filename* for non-ASCII names. Supply an
	// ASCII filename too for download clients that cannot use that parameter.
	fallback := strings.Map(func(r rune) rune {
		if r < 32 || r > 126 {
			return '_'
		}
		return r
	}, filename)
	if fallback != filename {
		return mime.FormatMediaType("attachment", map[string]string{"filename": fallback}) + strings.TrimPrefix(disposition, "attachment")
	}
	return disposition
}
