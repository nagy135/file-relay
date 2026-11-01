import assert from "node:assert/strict";
import test from "node:test";
import { isVideo, playbackURL } from "../assets/shared/video.js";
test("video links enable playback and remove forced downloads", () => {
  assert.equal(isVideo("clip.MP4"), true);
  assert.equal(isVideo("clip.webm"), true);
  assert.equal(isVideo("clip.mp4.txt"), false);
  assert.equal(playbackURL("https://relay.test/id?download=1"), "https://relay.test/id?play=1");
});
