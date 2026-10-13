package main

import (
	"regexp"
	"time"
)

var uuidPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)

type metadata struct {
	Filename   string    `json:"filename"`
	Size       int64     `json:"size"`
	UploadedAt time.Time `json:"uploaded_at"`
	ExpiresAt  time.Time `json:"expires_at"`
}

type relay struct {
	dir      string
	baseURL  string
	limit    int64
	now      func() time.Time
	uploads  chan struct{}
	username string
	password string
}

type listedFile struct {
	ID  string `json:"id"`
	URL string `json:"url"`
	metadata
}

func newRelay(cfg config) (*relay, error) {
	app := &relay{
		dir:      cfg.dataDir,
		baseURL:  cfg.baseURL,
		limit:    maxFileSize,
		now:      time.Now,
		uploads:  make(chan struct{}, maxConcurrentUploads),
		username: cfg.username,
		password: cfg.password,
	}
	if err := app.prepareStorage(); err != nil {
		return nil, err
	}
	return app, nil
}
