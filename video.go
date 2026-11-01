package main

import (
	"bytes"
	"html/template"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// Explicit MIME types keep playback consistent across host operating systems.
func videoContentType(filename string) string {
	return map[string]string{
		".mp4": "video/mp4", ".m4v": "video/mp4", ".mov": "video/quicktime",
		".webm": "video/webm", ".ogv": "video/ogg", ".ogg": "video/ogg",
		".mkv": "video/x-matroska", ".avi": "video/x-msvideo",
		".mpeg": "video/mpeg", ".mpg": "video/mpeg", ".3gp": "video/3gpp",
		".3g2": "video/3gpp2", ".ts": "video/mp2t", ".mts": "video/mp2t",
	}[strings.ToLower(filepath.Ext(filename))]
}

var videoPage = template.Must(template.ParseFS(webContent, "web/video.html"))

func serveVideoPage(w http.ResponseWriter, r *http.Request, id string, m metadata, now time.Time) {
	remaining := m.ExpiresAt.Sub(now)
	data := struct {
		Filename, ExpiresAt, ExpiresISO, StreamURL, DownloadURL, Remaining string
		RemainingMS                                                        int64
	}{
		Filename:    m.Filename,
		ExpiresAt:   m.ExpiresAt.UTC().Format("15:04 UTC · 2 Jan 2006"),
		ExpiresISO:  m.ExpiresAt.UTC().Format(time.RFC3339),
		StreamURL:   "/" + id + "?play=1&stream=1",
		DownloadURL: "/download/" + id + "/" + url.PathEscape(m.Filename),
		Remaining:   remaining.Round(time.Second).String(),
		RemainingMS: remaining.Milliseconds(),
	}
	var body bytes.Buffer
	if err := videoPage.Execute(&body, data); err != nil {
		http.Error(w, "Could not display video player", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(body.Len()))
	if r.Method != http.MethodHead {
		w.Write(body.Bytes())
	}
}
