package main

import "testing"

func TestLoadConfig(t *testing.T) {
	defaults, err := loadConfig(func(string) string { return "" })
	if err != nil || defaults.dataDir != "data" || defaults.baseURL != "http://localhost:13006" {
		t.Fatalf("defaults: %+v, %v", defaults, err)
	}
	values := map[string]string{"DATA_DIR": "/tmp/relay", "PUBLIC_BASE_URL": "https://relay.example///", "DASHBOARD_USERNAME": "admin", "DASHBOARD_PASSWORD": "test-secret"}
	cfg, err := loadConfig(func(key string) string { return values[key] })
	if err != nil || cfg.dataDir != values["DATA_DIR"] || cfg.baseURL != "https://relay.example" || cfg.username != "admin" || cfg.password != "test-secret" {
		t.Fatalf("configured: %+v, %v", cfg, err)
	}
	for _, invalid := range []string{"ftp://relay.example", "https://", "https://user:pass@relay.example", "https://relay.example/path", "https://relay.example?token=secret", "https://relay.example#fragment", ":invalid"} {
		t.Run(invalid, func(t *testing.T) {
			_, err := loadConfig(func(key string) string {
				if key == "PUBLIC_BASE_URL" {
					return invalid
				}
				return ""
			})
			if err == nil {
				t.Fatal("invalid public origin was accepted")
			}
		})
	}
}
