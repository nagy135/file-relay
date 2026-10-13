package main

import (
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDashboardAuthentication(t *testing.T) {
	for _, endpoint := range []string{"/dashboard", "/dashboard.js", "/api/files"} {
		for _, tc := range []struct {
			name, configuredUser, configuredPassword, user, password string
			want                                                     int
		}{
			{"disabled", "", "", "", "", 503},
			{"missing password", "admin", "", "admin", "", 503},
			{"missing username", "", "secret", "", "secret", 503},
			{"anonymous", "admin", "secret", "", "", 401},
			{"wrong username", "admin", "secret", "other", "secret", 401},
			{"wrong password", "admin", "secret", "admin", "wrong", 401},
			{"authenticated", "admin", "secret", "admin", "secret", 200},
		} {
			t.Run(endpoint+"/"+tc.name, func(t *testing.T) {
				a := testRelay(t)
				a.username, a.password = tc.configuredUser, tc.configuredPassword
				r := httptest.NewRequest("GET", endpoint, nil)
				if tc.user != "" || tc.password != "" {
					r.SetBasicAuth(tc.user, tc.password)
				}
				w := httptest.NewRecorder()
				a.handler().ServeHTTP(w, r)
				if w.Code != tc.want {
					t.Fatalf("status %d, want %d", w.Code, tc.want)
				}
				if tc.want == 401 && w.Header().Get("WWW-Authenticate") == "" {
					t.Fatal("missing authentication challenge")
				}
				if w.Header().Get("Cache-Control") != "no-store" {
					t.Fatal("dashboard response must not be cached")
				}
				if tc.want != 200 && strings.Contains(w.Body.String(), "File dashboard") {
					t.Fatal("dashboard exposed without authentication")
				}
			})
		}
	}
}
