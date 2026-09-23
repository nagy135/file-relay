"use strict";
const $ = (selector) => document.querySelector(selector);
let files = [],
  clockOffset = 0,
  loaded = false,
  refreshing = false,
  toastTimer;
const size = (bytes) =>
  bytes < 1000
    ? `${bytes} B`
    : bytes < 1e6
      ? `${(bytes / 1000).toFixed(1)} KB`
      : `${(bytes / 1e6).toFixed(1)} MB`;
const currentTime = () => Date.now() + clockOffset;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    $("#toast").hidden = true;
  }, 3000);
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function icon(kind) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute(
    "d",
    kind === "copy"
      ? "M7 6V3h10v11h-3 M3 6h11v11H3z"
      : "M10 2v10m-4-4 4 4 4-4M3 13v4h14v-4",
  );
  svg.append(path);
  return svg;
}
function updateTime(cell, file) {
  const remaining = Math.max(0, new Date(file.expires_at) - currentTime());
  const lifetime = new Date(file.expires_at) - new Date(file.uploaded_at);
  const minutes = Math.floor(remaining / 60000),
    seconds = Math.floor((remaining % 60000) / 1000);
  cell.querySelector(".remaining").textContent =
    `${minutes}m ${String(seconds).padStart(2, "0")}s left`;
  cell.querySelector("progress").value =
    lifetime > 0 ? Math.max(0, Math.min(100, (remaining / lifetime) * 100)) : 0;
  cell.classList.toggle("expiring", remaining < 10 * 60000);
}
function render() {
  const active = files.filter(
    (file) => new Date(file.expires_at).getTime() > currentTime(),
  );
  $("#total-files").textContent = active.length;
  $("#total-size").textContent = size(
    active.reduce((sum, file) => sum + file.size, 0),
  );
  $("#file-count").textContent = active.length;
  const query = $("#search").value.toLocaleLowerCase().trim();
  const visible = active.filter((file) =>
    file.filename.toLocaleLowerCase().includes(query),
  );
  const sorting = {
    newest: (a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at),
    expiry: (a, b) => new Date(a.expires_at) - new Date(b.expires_at),
    size: (a, b) => b.size - a.size,
    name: (a, b) => a.filename.localeCompare(b.filename),
  };
  visible.sort(sorting[$("#sort").value]);
  const fragment = document.createDocumentFragment();
  for (const file of visible) {
    const row = element("tr");
    row.dataset.id = file.id;
    const nameCell = element("td");
    const fileCell = element("div", "file-cell");
    const extension = file.filename.includes(".")
      ? file.filename.split(".").pop().slice(0, 4).toUpperCase()
      : "FILE";
    const info = element("div", "file-info");
    const name = element("a", "file-name", file.filename);
    name.href = file.url;
    name.title = file.filename;
    const uploaded = new Date(file.uploaded_at);
    info.append(
      name,
      element(
        "div",
        "file-meta",
        `Uploaded ${uploaded.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      ),
    );
    const fileIcon = element("span", "file-icon", extension || "FILE");
    fileIcon.setAttribute("aria-hidden", "true");
    fileCell.append(fileIcon, info);
    nameCell.append(fileCell);
    const sizeCell = element("td", "file-size", size(file.size));
    sizeCell.title = `${file.size.toLocaleString()} bytes`;
    const expiryCell = element("td", "expiry");
    expiryCell.title = `Expires ${new Date(file.expires_at).toLocaleString()}`;
    const label = element("div", "expiry-label");
    label.append(
      element("span", "remaining"),
      element("span", "expiry-clock", "of 1 hour"),
    );
    const progress = element("progress");
    progress.max = 100;
    progress.setAttribute(
      "aria-label",
      `Lifetime remaining for ${file.filename}`,
    );
    expiryCell.append(label, progress);
    updateTime(expiryCell, file);
    const actions = element("td", "actions");
    const copy = element("button", "icon-button");
    copy.type = "button";
    copy.title = `Copy link to ${file.filename}`;
    copy.setAttribute("aria-label", copy.title);
    copy.append(icon("copy"));
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(file.url);
        toast("Download link copied");
      } catch {
        toast("Couldn’t copy. Right-click the file name to copy its link.");
      }
    });
    const download = element("a", "icon-button");
    download.href = file.url;
    download.title = `Download ${file.filename}`;
    download.setAttribute("aria-label", download.title);
    download.append(icon("download"));
    actions.append(copy, download);
    row.append(nameCell, sizeCell, expiryCell, actions);
    fragment.append(row);
  }
  $("#files").replaceChildren(fragment);
  $("#table-wrap").hidden = !visible.length;
  $("#empty").hidden = !!visible.length;
  $("#empty-title").textContent =
    query && active.length ? "No matching files" : "Nothing in transit. Yet.";
  $("#empty-description").textContent =
    query && active.length
      ? "Try a different file name or clear your search."
      : "Upload a file and it will appear here until it expires.";
  $("#empty-upload").hidden = !!(query && active.length);
  $("#showing").textContent =
    `Showing ${visible.length} of ${active.length} ${active.length === 1 ? "file" : "files"}`;
}
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
    if (file) updateTime(row.querySelector(".expiry"), file);
  }
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) refresh();
});
refresh();
