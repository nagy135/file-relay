package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPrepareStoragePreservesActiveUploadsAndRemovesInterruptedOnes(t *testing.T) {
	a := testRelay(t)
	_, active := uploadFile(t, a, "active.txt", "keep")
	interrupted := filepath.Join(a.dir, ".upload-interrupted")
	if err := os.Mkdir(interrupted, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(interrupted, "content"), []byte("partial"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := a.prepareStorage(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(interrupted); !os.IsNotExist(err) {
		t.Fatalf("interrupted upload remains: %v", err)
	}
	if _, err := a.readMetadata(strings.TrimPrefix(active, "/")); err != nil {
		t.Fatalf("active upload was lost: %v", err)
	}
	start := a.now()
	a.now = func() time.Time { return start.Add(defaultRetention) }
	if err := a.prepareStorage(); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(a.dir, strings.TrimPrefix(active, "/"))); !os.IsNotExist(err) {
		t.Fatalf("expired upload remains after startup: %v", err)
	}
}
