package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"syscall"
	"time"
)

const maxFileSize int64 = 200_000_000
const retention = time.Hour

//go:embed index.html
var indexHTML []byte

//go:embed dashboard.html
var dashboardHTML []byte

//go:embed styles.css
var stylesCSS []byte

//go:embed dashboard.js
var dashboardJS []byte

//go:embed upload.js
var uploadJS []byte

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

func main() {
	if len(os.Args) == 2 && os.Args[1] == "healthcheck" {
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get("http://127.0.0.1:8080/healthz")
		if err != nil {
			log.Fatal(err)
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			os.Exit(1)
		}
		return
	}
	dir := os.Getenv("DATA_DIR")
	if dir == "" {
		dir = "data"
	}
	base := strings.TrimRight(os.Getenv("PUBLIC_BASE_URL"), "/")
	if base == "" {
		base = "http://localhost:13006"
	}
	u, err := url.Parse(base)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "" {
		log.Fatal("PUBLIC_BASE_URL must be an http(s) origin without a path, query, or credentials")
	}
	if err := os.MkdirAll(dir, 0700); err != nil {
		log.Fatal(err)
	}
	app := &relay{dir: dir, baseURL: base, limit: maxFileSize, now: time.Now, uploads: make(chan struct{}, 4), username: os.Getenv("DASHBOARD_USERNAME"), password: os.Getenv("DASHBOARD_PASSWORD")}
	// Only one relay process should use this data directory. Remove uploads left
	// unfinished by a previous process before accepting any new requests.
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Fatal(err)
	}
	for _, entry := range entries {
		if strings.HasPrefix(entry.Name(), ".upload-") {
			if err := os.RemoveAll(filepath.Join(dir, entry.Name())); err != nil {
				log.Fatal(err)
			}
		}
	}
	app.cleanup()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	go func() {
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				app.cleanup()
			case <-ctx.Done():
				return
			}
		}
	}()
	server := &http.Server{Addr: ":8080", Handler: app.handler(), ReadHeaderTimeout: 10 * time.Second, ReadTimeout: 30 * time.Minute, IdleTimeout: time.Minute, MaxHeaderBytes: 32 << 10}
	done := make(chan struct{})
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdown); err != nil {
			log.Printf("shutdown: %v", err)
		}
		close(done)
	}()
	log.Printf("listening on %s; public URL %s; files expire after %s", server.Addr, base, retention)
	if err := server.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	<-done
}

func (a *relay) handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(indexHTML)
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok\n")) })
	mux.HandleFunc("GET /styles.css", asset("text/css; charset=utf-8", stylesCSS))
	mux.HandleFunc("GET /upload.js", asset("text/javascript; charset=utf-8", uploadJS))
	mux.HandleFunc("GET /dashboard.js", a.authenticate(asset("text/javascript; charset=utf-8", dashboardJS)))
	mux.HandleFunc("GET /dashboard", a.authenticate(asset("text/html; charset=utf-8", dashboardHTML)))
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

func asset(contentType string, body []byte) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", contentType)
		w.Write(body)
	}
}

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

type listedFile struct {
	ID  string `json:"id"`
	URL string `json:"url"`
	metadata
}

func (a *relay) listFiles(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(a.dir)
	if err != nil {
		fail(w, http.StatusInternalServerError, "could not read file storage")
		return
	}
	now := a.now().UTC()
	files := make([]listedFile, 0)
	for _, entry := range entries {
		if !entry.IsDir() || !uuidPattern.MatchString(entry.Name()) {
			continue
		}
		m, err := a.readMetadata(entry.Name())
		if err != nil || !now.Before(m.ExpiresAt) {
			continue
		}
		// Ignore incomplete entries, including files removed by cleanup during a scan.
		if info, err := os.Stat(filepath.Join(a.dir, entry.Name(), "content")); err != nil || !info.Mode().IsRegular() {
			continue
		}
		files = append(files, listedFile{ID: entry.Name(), URL: a.baseURL + "/" + entry.Name(), metadata: m})
	}
	sort.Slice(files, func(i, j int) bool {
		if files[i].UploadedAt.Equal(files[j].UploadedAt) {
			return files[i].ID < files[j].ID
		}
		return files[i].UploadedAt.After(files[j].UploadedAt)
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Files []listedFile `json:"files"`
		Now   time.Time    `json:"now"`
	}{Files: files, Now: now})
}

func fail(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

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
		fail(w, 400, "expected multipart/form-data with one file field")
		return
	}
	part, err := reader.NextPart()
	if err != nil {
		uploadReadError(w, err)
		return
	}
	if part.FormName() != "file" || part.FileName() == "" {
		fail(w, 400, "expected exactly one file in the file field")
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
		fail(w, 507, "storage unavailable")
		return
	}
	defer os.RemoveAll(tmp)
	f, err := os.OpenFile(filepath.Join(tmp, "content"), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
	if err != nil {
		fail(w, 507, "storage unavailable")
		return
	}
	size, copyErr := io.Copy(f, io.LimitReader(part, a.limit+1))
	if copyErr == nil {
		copyErr = f.Sync()
	}
	closeErr := f.Close()
	if size > a.limit {
		fail(w, 413, "file exceeds 200 MB limit")
		return
	}
	if copyErr != nil {
		var pathErr *os.PathError
		if errors.As(copyErr, &pathErr) {
			fail(w, 507, "storage unavailable")
		} else {
			uploadReadError(w, copyErr)
		}
		return
	}
	if closeErr != nil {
		fail(w, 507, "storage unavailable")
		return
	}
	if _, err := reader.NextPart(); err != io.EOF {
		if err != nil {
			uploadReadError(w, err)
		} else {
			fail(w, 400, "expected exactly one file")
		}
		return
	}
	// Consume any multipart epilogue so the total request limit is enforced too.
	if _, err := io.Copy(io.Discard, r.Body); err != nil {
		uploadReadError(w, err)
		return
	}
	now := a.now().UTC()
	m := metadata{Filename: filename, Size: size, UploadedAt: now, ExpiresAt: now.Add(retention)}
	encoded, err := json.Marshal(m)
	if err != nil {
		fail(w, 500, "could not encode metadata")
		return
	}
	if err := os.WriteFile(filepath.Join(tmp, "metadata.json"), encoded, 0600); err != nil {
		fail(w, 507, "storage unavailable")
		return
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		fail(w, 500, "could not generate file ID")
		return
	}
	random[6] = (random[6] & 0x0f) | 0x40
	random[8] = (random[8] & 0x3f) | 0x80
	id := fmt.Sprintf("%x-%x-%x-%x-%x", random[:4], random[4:6], random[6:8], random[8:10], random[10:])
	if err := os.Rename(tmp, filepath.Join(a.dir, id)); err != nil {
		fail(w, 507, "storage unavailable")
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
		fail(w, 413, "upload request too large")
		return
	}
	fail(w, 400, "incomplete or invalid multipart upload")
}

func (a *relay) readMetadata(id string) (metadata, error) {
	var m metadata
	b, err := os.ReadFile(filepath.Join(a.dir, id, "metadata.json"))
	if err != nil {
		return m, err
	}
	err = json.Unmarshal(b, &m)
	return m, err
}

func (a *relay) download(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !uuidPattern.MatchString(id) {
		http.NotFound(w, r)
		return
	}
	m, err := a.readMetadata(id)
	if err != nil || !a.now().Before(m.ExpiresAt) {
		http.NotFound(w, r)
		return
	}
	f, err := os.Open(filepath.Join(a.dir, id, "content"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": m.Filename}))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeContent(w, r, m.Filename, m.UploadedAt, f)
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
