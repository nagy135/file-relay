import { element } from "../shared/dom.js";
import {
  formatSize as size,
  formatDuration as duration,
} from "../shared/format.js";

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
export function updateTime(cell, file, now) {
  const remaining = Math.max(0, new Date(file.expires_at) - now);
  const lifetime = new Date(file.expires_at) - new Date(file.uploaded_at);
  cell.querySelector(".remaining").textContent = `${duration(remaining)} left`;
  cell.querySelector(".expiry-clock").textContent = `of ${duration(lifetime)}`;
  cell.querySelector("progress").value =
    lifetime > 0 ? Math.max(0, Math.min(100, (remaining / lifetime) * 100)) : 0;
  cell.classList.toggle("expiring", remaining < 10 * 60000);
}

export function createFileRow(file, now, toast) {
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
      `Uploaded ${uploaded.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
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
  label.append(element("span", "remaining"), element("span", "expiry-clock"));
  const progress = element("progress");
  progress.max = 100;
  progress.setAttribute(
    "aria-label",
    `Lifetime remaining for ${file.filename}`,
  );
  expiryCell.append(label, progress);
  updateTime(expiryCell, file, now);
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
  return row;
}
