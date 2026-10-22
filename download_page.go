package main

import (
	"bytes"
	"fmt"
	"html/template"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

var downloadPage = template.Must(template.ParseFS(webContent, "web/download.html"))

func acceptsHTML(accept string) bool {
	for _, value := range strings.Split(accept, ",") {
		kind, params, err := mime.ParseMediaType(strings.TrimSpace(value))
		if err != nil || kind != "text/html" {
			continue
		}
		if quality, ok := params["q"]; ok {
			q, err := strconv.ParseFloat(quality, 64)
			if err != nil || !(q > 0 && q <= 1) {
				continue
			}
		}
		return true
	}
	return false
}

func serveDownloadPage(w http.ResponseWriter, r *http.Request, id string, m metadata) {
	data := struct {
		Filename, Size, ExpiresAt, DownloadURL, ZipURL string
	}{
		Filename:    m.Filename,
		Size:        fmt.Sprintf("%d bytes", m.Size),
		ExpiresAt:   m.ExpiresAt.UTC().Format(time.RFC1123),
		DownloadURL: "/download/" + id + "/" + url.PathEscape(m.Filename),
	}
	if strings.EqualFold(filepath.Ext(m.Filename), ".ipa") {
		data.ZipURL = "/download/" + id + "/" + url.PathEscape(m.Filename+".zip")
	}
	var body bytes.Buffer
	if err := downloadPage.Execute(&body, data); err != nil {
		http.Error(w, "Could not display download page", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Length", strconv.Itoa(body.Len()))
	if r.Method != http.MethodHead {
		w.Write(body.Bytes())
	}
}
