package main

import (
	"errors"
	"net/url"
	"strings"
	"time"
)

const (
	maxFileSize          int64 = 200_000_000
	defaultRetention           = time.Hour
	maxRetention               = 30 * 24 * time.Hour
	maxConcurrentUploads       = 4
	listenAddress              = ":8080"
)

type config struct {
	dataDir  string
	baseURL  string
	username string
	password string
}

func loadConfig(getenv func(string) string) (config, error) {
	cfg := config{
		dataDir:  getenv("DATA_DIR"),
		baseURL:  strings.TrimRight(getenv("PUBLIC_BASE_URL"), "/"),
		username: getenv("DASHBOARD_USERNAME"),
		password: getenv("DASHBOARD_PASSWORD"),
	}
	if cfg.dataDir == "" {
		cfg.dataDir = "data"
	}
	if cfg.baseURL == "" {
		cfg.baseURL = "http://localhost:13006"
	}
	u, err := url.Parse(cfg.baseURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" {
		return config{}, errors.New("PUBLIC_BASE_URL must be an http(s) origin without a path, query, or credentials")
	}
	return cfg, nil
}
