import { $, element } from "../shared/dom.js";
import { renderDashboard } from "./view.js";
import { updateTime } from "./file-row.js";

export function startDashboard() {
  let files = [],
    clockOffset = 0,
    loaded = false,
    refreshing = false;
  const currentTime = () => Date.now() + clockOffset;
  const render = () => renderDashboard(files, currentTime());
  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    $("#refresh").disabled = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch("/api/files", {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session needs authentication. Reload the page to sign in."
            : "Couldn’t load files. Try refreshing in a moment.",
        );
      const data = await response.json();
      files = data.files;
      clockOffset = new Date(data.now).getTime() - Date.now();
      loaded = true;
      $("#error").hidden = true;
      $("#sync-status").replaceChildren(
        element("span", "dot"),
        document.createTextNode("Live · Updates every 15s"),
      );
      render();
    } catch (error) {
      $("#error").textContent =
        error.name === "AbortError"
          ? "The request timed out. Try refreshing in a moment."
          : error.message;
      $("#error").hidden = false;
      $("#sync-status").textContent = "Disconnected · Retrying automatically";
      if (!loaded) {
        $("#empty-title").textContent = "Files are unavailable";
        $("#empty-description").textContent =
          "Use the refresh button to try again.";
        $("#showing").textContent = "Unable to load files";
      }
    } finally {
      clearTimeout(timeout);
      refreshing = false;
      $("#refresh").disabled = false;
    }
  }
  $("#search").addEventListener("input", () => {
    if (loaded) render();
  });
  $("#sort").addEventListener("change", () => {
    if (loaded) render();
  });
  $("#refresh").addEventListener("click", refresh);
  setInterval(() => {
    if (!document.hidden) refresh();
  }, 15000);
  setInterval(() => {
    if (!loaded || document.hidden) return;
    if (
      files.some((file) => new Date(file.expires_at).getTime() <= currentTime())
    ) {
      files = files.filter(
        (file) => new Date(file.expires_at).getTime() > currentTime(),
      );
      render();
    }
    const byID = new Map(files.map((file) => [file.id, file]));
    for (const row of $("#files").rows) {
      const file = byID.get(row.dataset.id);
      if (file) updateTime(row.querySelector(".expiry"), file, currentTime());
    }
  }, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  refresh();
}
