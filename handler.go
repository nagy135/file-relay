package main

import (
	"encoding/json"
	"net/http"
)

func (a *relay) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", asset("index.html", "text/html; charset=utf-8"))
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok\n")) })
	mux.HandleFunc("GET /styles.css", asset("styles.css", "text/css; charset=utf-8"))
	mux.HandleFunc("GET /favicon.ico", asset("assets/favicon.ico", "image/vnd.microsoft.icon"))
	mux.HandleFunc("GET /upload.js", asset("upload.js", "text/javascript; charset=utf-8"))
	mux.HandleFunc("GET /dashboard.js", a.authenticate(asset("dashboard.js", "text/javascript; charset=utf-8")))
	mux.HandleFunc("GET /dashboard", a.authenticate(asset("dashboard.html", "text/html; charset=utf-8")))
	mux.HandleFunc("GET /assets/{path...}", a.webAsset)
	mux.HandleFunc("GET /api/files", a.authenticate(a.listFiles))
	mux.HandleFunc("POST /upload", a.upload)
	mux.HandleFunc("GET /{id}", a.download)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
		mux.ServeHTTP(w, r)
	})
}

func fail(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
