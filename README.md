# File relay

A public file relay: upload one file, receive a random UUIDv4 download URL.
Files expire exactly seven days after a completed upload. Downloads do not
extend expiry. No accounts, upload tokens, or file listing.

## Run with Docker Compose

```sh
cp .env.example .env
docker compose up -d --build
```

Open http://localhost:13006 for the upload page. Set `PUBLIC_BASE_URL` in `.env`
to the public origin when running behind a reverse proxy. The container listens
on port 8080; Compose publishes it only on `127.0.0.1:13006`.

```sh
curl -fsS -F 'file=@test.txt' http://localhost:13006/upload
```

Successful uploads return HTTP 201 and JSON:

```json
{
  "url": "https://relay.infiniter.tech/550e8400-e29b-41d4-a716-446655440000",
  "filename": "test.txt",
  "size": 12,
  "uploaded_at": "2026-09-22T12:00:00Z",
  "expires_at": "2026-09-29T12:00:00Z"
}
```

The `Location` response header also contains the download URL. Downloads use
`Content-Disposition: attachment` with the original filename. HEAD requests and
byte ranges are supported. Unknown and expired links return HTTP 404.

The limit is **200 MB (200,000,000 bytes)** per file, including files exactly at
the limit. Larger files return HTTP 413. Requests must contain exactly one
multipart `file` field. The full request has an additional 1 MiB allowance for
multipart headers. At most four uploads are accepted concurrently; additional
uploads return HTTP 503 with `Retry-After: 5`.

## nixpi

The checkout lives at `/home/infiniter/services/file-relay`. Its `.env` contains:

```sh
PUBLIC_BASE_URL=https://relay.infiniter.tech
```

Start and stop manually:

```sh
cd ~/services/file-relay
docker compose up -d --build
docker compose logs -f
docker compose down
```

There is no application systemd unit or automatic restart policy. Start Compose
again after reboot. Existing nginx/ACME and Websupport DDNS configuration in the
`nix-server` repository supplies the public hostname, HTTPS, and proxy to
`127.0.0.1:13006`. nginx must allow the multipart request overhead and disable
request buffering for streaming uploads.

```sh
curl -fsS -F 'file=@test.txt' https://relay.infiniter.tech/upload
# Print only the download URL (requires jq):
curl -fsS -F 'file=@test.txt' https://relay.infiniter.tech/upload | jq -r .url
```

Files and metadata live in the `relay-data` Docker volume at `/data`, surviving
container replacement and `docker compose down`. `docker compose down -v`
deletes that volume and all uploads. Only one relay instance should use it.
Expired files are removed every minute and at startup. Expired links stop
working immediately, even before cleanup. Cleanup runs only while the app runs;
after downtime, it removes expired files on the next startup. Incomplete uploads
are removed on error or startup after a crash.

## Development

Go 1.26 or later, standard library only:

```sh
go test -race ./...
go vet ./...
PUBLIC_BASE_URL=http://localhost:8080 go run .
```

`DATA_DIR` defaults to `./data` outside Docker. `GET /healthz` reports liveness.
Uploads stream to temporary files and become visible only after completion.
The final Docker image is a non-root static Go binary with a read-only root
filesystem and a writable data volume.
