import assert from "node:assert/strict";
import test from "node:test";
import { selectFiles } from "../assets/dashboard/files.js";
import { formatDuration, formatSize } from "../assets/shared/format.js";

const now = Date.parse("2026-10-13T12:00:00Z");
const files = [
  {
    id: "b",
    filename: "beta.txt",
    size: 10,
    uploaded_at: "2026-10-13T11:30:00Z",
    expires_at: "2026-10-13T12:30:00Z",
  },
  {
    id: "a",
    filename: "alpha.txt",
    size: 20,
    uploaded_at: "2026-10-13T11:45:00Z",
    expires_at: "2026-10-13T12:15:00Z",
  },
  {
    id: "expired",
    filename: "expired.txt",
    size: 99,
    uploaded_at: "2026-10-13T11:00:00Z",
    expires_at: "2026-10-13T12:00:00Z",
  },
];
test("dashboard selection preserves expiry boundaries, sorts, search and source data", () => {
  for (const order of ["newest", "expiry", "size", "name"])
    assert.deepEqual(
      selectFiles(files, now, "", order).map((f) => f.id),
      ["a", "b"],
    );
  assert.deepEqual(
    selectFiles(files, now, "beta", "name").map((f) => f.id),
    ["b"],
  );
  assert.equal(files.length, 3);
  assert.equal(files[0].id, "b");
  assert.deepEqual(selectFiles(files, now, "missing", "name"), []);
});
test("file sizes and stored lifetimes retain the dashboard display format", () => {
  assert.equal(formatSize(200_000_000), "200.0 MB");
  assert.equal(formatDuration(-1), "0m 00s");
  assert.equal(formatDuration(7 * 86400000), "7d 0h");
});
