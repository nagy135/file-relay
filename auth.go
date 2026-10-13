package main

import (
	"crypto/sha256"
	"crypto/subtle"
	"net/http"
)

func (a *relay) authenticate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if a.username == "" || a.password == "" {
			fail(w, http.StatusServiceUnavailable, "dashboard credentials are not configured")
			return
		}
		username, password, ok := r.BasicAuth()
		userHash, passHash := sha256.Sum256([]byte(username)), sha256.Sum256([]byte(password))
		wantUser, wantPass := sha256.Sum256([]byte(a.username)), sha256.Sum256([]byte(a.password))
		valid := subtle.ConstantTimeCompare(userHash[:], wantUser[:]) & subtle.ConstantTimeCompare(passHash[:], wantPass[:])
		if !ok || valid != 1 {
			w.Header().Set("WWW-Authenticate", `Basic realm="File relay dashboard", charset="UTF-8"`)
			fail(w, http.StatusUnauthorized, "dashboard authentication required")
			return
		}
		next(w, r)
	}
}
