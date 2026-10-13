package main

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

func (a *relay) upload(w http.ResponseWriter, r *http.Request) {
	select {
	case a.uploads <- struct{}{}:
		defer func() { <-a.uploads }()
	default:
		w.Header().Set("Retry-After", "5")
		fail(w, http.StatusServiceUnavailable, "busy; retry shortly")
		return
	}
	// Bound both the file itself and the complete multipart request.
	r.Body = http.MaxBytesReader(w, r.Body, a.limit+(1<<20))
	reader, err := r.MultipartReader()
	if err != nil {
		fail(w, http.StatusBadRequest, "expected multipart/form-data with one file field")
		return
	}
	validFor := defaultRetention
	hasRetention := false
	readExpiry := func(part *multipart.Part) bool {
		if hasRetention || part.FormName() != "expires_in" || part.FileName() != "" {
			fail(w, http.StatusBadRequest, "expected one file and at most one expires_in field")
			return false
		}
		value, err := readRetention(part)
		if err != nil {
			if errors.Is(err, errRetention) {
				fail(w, http.StatusBadRequest, err.Error())
			} else {
				uploadReadError(w, err)
			}
			return false
		}
		validFor, hasRetention = value, true
		return true
	}
	part, err := reader.NextPart()
	for err == nil && part.FormName() == "expires_in" {
		if !readExpiry(part) {
			return
		}
		part, err = reader.NextPart()
	}
	if err != nil {
		uploadReadError(w, err)
		return
	}
	if part.FormName() != "file" || part.FileName() == "" {
		fail(w, http.StatusBadRequest, "expected exactly one file in the file field")
		return
	}
	filename := filepath.Base(strings.ReplaceAll(part.FileName(), `\`, "/"))
	filename = strings.Map(func(r rune) rune {
		if r < 32 || r == 127 {
			return -1
		}
		return r
	}, filename)
	if filename == "" || filename == "." || filename == ".." {
		filename = "download"
	}
	tmp, err := os.MkdirTemp(a.dir, ".upload-")
	if err != nil {
		fail(w, http.StatusInsufficientStorage, "storage unavailable")
		return
	}
	defer os.RemoveAll(tmp)
	f, err := os.OpenFile(filepath.Join(tmp, "content"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		fail(w, http.StatusInsufficientStorage, "storage unavailable")
		return
	}
	size, copyErr := io.Copy(f, io.LimitReader(part, a.limit+1))
	if copyErr == nil {
		copyErr = f.Sync()
	}
	closeErr := f.Close()
	if size > a.limit {
		fail(w, http.StatusRequestEntityTooLarge, "file exceeds 200 MB limit")
		return
	}
	if copyErr != nil {
		var pathErr *os.PathError
		if errors.As(copyErr, &pathErr) {
			fail(w, http.StatusInsufficientStorage, "storage unavailable")
		} else {
			uploadReadError(w, copyErr)
		}
		return
	}
	if closeErr != nil {
		fail(w, http.StatusInsufficientStorage, "storage unavailable")
		return
	}
	for {
		part, err := reader.NextPart()
		if err == io.EOF {
			break
		}
		if err != nil {
			uploadReadError(w, err)
			return
		}
		if !readExpiry(part) {
			return
		}
	}
	// Consume any multipart epilogue so the total request limit is enforced too.
	if _, err := io.Copy(io.Discard, r.Body); err != nil {
		uploadReadError(w, err)
		return
	}
	now := a.now().UTC()
	m := metadata{Filename: filename, Size: size, UploadedAt: now, ExpiresAt: now.Add(validFor)}
	encoded, err := json.Marshal(m)
	if err != nil {
		fail(w, http.StatusInternalServerError, "could not encode metadata")
		return
	}
	if err := os.WriteFile(filepath.Join(tmp, "metadata.json"), encoded, 0600); err != nil {
		fail(w, http.StatusInsufficientStorage, "storage unavailable")
		return
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		fail(w, http.StatusInternalServerError, "could not generate file ID")
		return
	}
	random[6] = (random[6] & 0x0f) | 0x40
	random[8] = (random[8] & 0x3f) | 0x80
	id := fmt.Sprintf("%x-%x-%x-%x-%x", random[:4], random[4:6], random[6:8], random[8:10], random[10:])
	if err := os.Rename(tmp, filepath.Join(a.dir, id)); err != nil {
		fail(w, http.StatusInsufficientStorage, "storage unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Location", a.baseURL+"/"+id)
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(struct {
		URL string `json:"url"`
		metadata
	}{URL: a.baseURL + "/" + id, metadata: m})
}

func uploadReadError(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		fail(w, http.StatusRequestEntityTooLarge, "upload request too large")
		return
	}
	fail(w, http.StatusBadRequest, "incomplete or invalid multipart upload")
}
