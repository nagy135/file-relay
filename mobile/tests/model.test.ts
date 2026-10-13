import assert from "node:assert/strict";
import test from "node:test";
import { basicAuth, normalizeBaseUrl } from "../src/lib/connection.ts";
import { formatDuration } from "../src/lib/format.ts";
import {
  isUploadResult,
  safeFilename,
  visibleFiles,
} from "../src/lib/files.ts";
import type { RelayFile } from "../src/lib/types.ts";

const now = Date.parse("2026-10-13T12:00:00Z");
const file = (
  id: string,
  size: number,
  uploaded: string,
  expires: string,
): RelayFile => ({
  id,
  filename: `${id}.txt`,
  size,
  uploaded_at: uploaded,
  expires_at: expires,
  url: `https://relay.example/${id}`,
});
const files = [
  file("beta", 20, "2026-10-13T11:30:00Z", "2026-10-13T12:30:00Z"),
  file("alpha", 40, "2026-10-13T11:50:00Z", "2026-10-13T12:10:00Z"),
  file("expired", 100, "2026-10-13T11:00:00Z", "2026-10-13T12:00:00Z"),
];

test("expired files vanish at the exact expiry, and every sort and search works without mutating data", () => {
  assert.deepEqual(
    visibleFiles(files, now, "", "newest").map((f) => f.id),
    ["alpha", "beta"],
  );
  assert.deepEqual(
    visibleFiles(files, now, "", "expiry").map((f) => f.id),
    ["alpha", "beta"],
  );
  assert.deepEqual(
    visibleFiles(files, now, "", "size").map((f) => f.id),
    ["alpha", "beta"],
  );
  assert.deepEqual(
    visibleFiles(files, now, "", "name").map((f) => f.id),
    ["alpha", "beta"],
  );
  assert.deepEqual(
    visibleFiles(files, now, " BETA ", "name").map((f) => f.id),
    ["beta"],
  );
  assert.equal(files.length, 3);
  assert.equal(formatDuration(-1), "0m 00s");
  assert.equal(formatDuration(7 * 86400000), "7d 0h");
});
test("relay origins reject unsafe schemes, embedded credentials, and endpoint paths", () => {
  assert.equal(
    normalizeBaseUrl(" https://relay.infiniter.tech/ "),
    "https://relay.infiniter.tech",
  );
  assert.equal(
    normalizeBaseUrl("http://10.0.2.2:18080"),
    "http://10.0.2.2:18080",
  );
  for (const value of [
    "http://relay.infiniter.tech",
    "file:///tmp/file",
    "https://a:b@relay.example",
    "https://relay.example/upload",
    "https://relay.example?token=a",
  ])
    assert.throws(() => normalizeBaseUrl(value));
});
test("Basic authentication preserves Unicode credentials", () => {
  assert.equal(
    basicAuth({ baseUrl: "", username: "viktor", password: "päss🔑" }),
    `Basic ${Buffer.from("viktor:päss🔑").toString("base64")}`,
  );
});
test("shared filenames stay inside their private cache directory", () => {
  assert.equal(safeFilename("../file\u0000.txt"), ".._file_.txt");
  assert.equal(safeFilename(".."), "shared-file");
  assert.equal(safeFilename("photo.jpg"), "photo.jpg");
});
test("upload success requires a usable link, matching byte count, and valid lifetime", () => {
  assert.ok(isUploadResult(files[0], 20));
  assert.equal(isUploadResult(files[0], 21), false);
  assert.equal(
    isUploadResult({ ...files[0], url: "javascript:alert(1)" }, 20),
    false,
  );
  assert.equal(
    isUploadResult({ ...files[0], expires_at: files[0].uploaded_at }, 20),
    false,
  );
});
