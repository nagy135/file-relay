import assert from "node:assert/strict";
import test from "node:test";
import { isVideo, playbackURL } from "../assets/shared/video.js";
test("video links enable playback and remove forced downloads", () => {
  assert.equal(isVideo("clip.MP4"), true);
  assert.equal(isVideo("clip.webm"), true);
  assert.equal(isVideo("clip.mp4.txt"), false);
  assert.equal(playbackURL("https://relay.test/id?download=1"), "https://relay.test/id?play=1");
});

import { formatCountdown } from "../assets/shared/countdown.js";
test("countdown ticks down to expiry and supports month-long links", () => {
  assert.equal(formatCountdown(3600000), "01:00:00");
  assert.equal(formatCountdown(3599000), "00:59:59");
  assert.equal(formatCountdown(1), "00:00:01");
  assert.equal(formatCountdown(0), "Expired");
  assert.equal(formatCountdown(-1000), "Expired");
  assert.equal(formatCountdown(30 * 86400000), "30d 00:00:00");
});
