package main

import (
	"embed"
	"io/fs"
	"mime"
	"net/http"
	"path"
	"strings"
)

//go:embed web/*.html web/*.js web/*.css web/assets
var webContent embed.FS

func asset(name, contentType string) http.HandlerFunc {
	body, err := webContent.ReadFile("web/" + name)
	if err != nil {
		panic(err)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		w.Write(body)
	}
}

// Module and stylesheet requests expose only individual embedded files.
// They never list directories or read from the relay's upload storage.
func (a *relay) webAsset(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("path")
	serve := func(w http.ResponseWriter, r *http.Request) {
		if !fs.ValidPath(name) {
			http.NotFound(w, r)
			return
		}
		body, err := webContent.ReadFile("web/assets/" + name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		contentType := mime.TypeByExtension(path.Ext(name))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		w.Header().Set("Content-Type", contentType)
		w.Write(body)
	}
	if strings.HasPrefix(name, "dashboard/") {
		a.authenticate(serve)(w, r)
		return
	}
	serve(w, r)
}
