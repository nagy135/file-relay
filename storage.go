package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (a *relay) readMetadata(id string) (metadata, error) {
	var m metadata
	b, err := os.ReadFile(filepath.Join(a.dir, id, "metadata.json"))
	if err != nil {
		return m, err
	}
	err = json.Unmarshal(b, &m)
	return m, err
}

func (a *relay) cleanup() {
	entries, err := os.ReadDir(a.dir)
	if err != nil {
		log.Printf("cleanup: %v", err)
		return
	}
	for _, entry := range entries {
		if !entry.IsDir() || !uuidPattern.MatchString(entry.Name()) {
			continue
		}
		m, err := a.readMetadata(entry.Name())
		if err != nil {
			log.Printf("cleanup metadata %s: %v", entry.Name(), err)
			continue
		}
		if !a.now().Before(m.ExpiresAt) {
			if err := os.RemoveAll(filepath.Join(a.dir, entry.Name())); err != nil {
				log.Printf("cleanup file %s: %v", entry.Name(), err)
			}
		}
	}
}

// prepareStorage runs once before serving requests. Only one process may use a
// data directory, as unfinished upload directories are removed on startup.
func (a *relay) prepareStorage() error {
	if err := os.MkdirAll(a.dir, 0700); err != nil {
		return err
	}
	entries, err := os.ReadDir(a.dir)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".upload-") {
			if err := os.RemoveAll(filepath.Join(a.dir, entry.Name())); err != nil {
				return err
			}
		}
	}
	a.cleanup()
	return nil
}

func (a *relay) cleanupLoop(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			a.cleanup()
		case <-ctx.Done():
			return
		}
	}
}
