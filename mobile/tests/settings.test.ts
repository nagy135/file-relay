import assert from "node:assert/strict";
import test from "node:test";
import { decodeSettings } from "../src/lib/settings.ts";

const saved = {
  baseUrl: "https://relay.example",
  username: "viktor",
  password: "päss🔑",
};
test("older installed settings gain the default expiry without losing credentials", () => {
  assert.deepEqual(decodeSettings(saved), {
    ...saved,
    defaultExpirySeconds: 3600,
  });
});
test("saved upload preference is restored and invalid preferences fall back safely", () => {
  assert.equal(
    decodeSettings({ ...saved, defaultExpirySeconds: 2592000 })
      .defaultExpirySeconds,
    2592000,
  );
  for (const value of [null, "86400", 3599, 2592001, 3600.5]) {
    const result = decodeSettings({ ...saved, defaultExpirySeconds: value });
    assert.equal(result.defaultExpirySeconds, 3600);
    assert.equal(result.password, saved.password);
  }
});
