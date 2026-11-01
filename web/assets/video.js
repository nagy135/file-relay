import { formatCountdown } from "./shared/countdown.js";

const expiry = document.querySelector(".video-expiry");
const countdown = expiry.querySelector(".video-countdown");
const until = expiry.querySelector("time");
const deadline = Date.now() + Number(expiry.dataset.remainingMs);
until.textContent = new Date(until.dateTime).toLocaleString([], {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
});

function tick() {
  const remaining = Math.max(0, deadline - Date.now());
  countdown.textContent = formatCountdown(remaining);
  if (remaining > 0) return;
  clearInterval(timer);
  const video = document.querySelector("video");
  video.pause();
  video.removeAttribute("src");
  video.load();
  const download = document.querySelector(".download-button");
  download.removeAttribute("href");
  download.setAttribute("aria-disabled", "true");
}
const timer = setInterval(tick, 1000);
document.addEventListener("visibilitychange", tick);
tick();
