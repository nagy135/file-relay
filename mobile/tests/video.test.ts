import assert from "node:assert/strict";
import test from "node:test";
import { isVideo, playbackURL } from "../src/lib/video.ts";
test("video playback links open player rather than forced download", () => {
  assert.equal(isVideo("clip.MP4"), true);
  assert.equal(isVideo("clip.mkv"), true);
  assert.equal(isVideo("clip.mp4.txt"), false);
  assert.equal(playbackURL("https://relay.test/id?download=1"), "https://relay.test/id?play=1");
});
