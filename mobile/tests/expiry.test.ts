import assert from "node:assert/strict";
import test from "node:test";
import { uploadParameters } from "../src/lib/expiry.ts";

test("default upload stays compatible; chosen duration is serialized in seconds", () => {
  assert.deepEqual(uploadParameters(3600), {});
  assert.deepEqual(uploadParameters(3661), { expires_in: "3661" });
  assert.deepEqual(uploadParameters(86400), { expires_in: "86400" });
  assert.deepEqual(uploadParameters(2592000), { expires_in: "2592000" });
});

test("invalid upload lifetimes are rejected before starting a native transfer", () => {
  for (const value of [0, 3599, 2592001, 3600.5, Infinity, NaN])
    assert.throws(() => uploadParameters(value));
});
