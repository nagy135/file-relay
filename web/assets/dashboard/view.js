import { $, createToast } from "../shared/dom.js";
import { formatSize as size } from "../shared/format.js";
import { selectFiles } from "./files.js";
import { createFileRow } from "./file-row.js";

const toast = createToast();
export function renderDashboard(files, now) {
  const active = files.filter(
    (file) => new Date(file.expires_at).getTime() > now,
  );
  $("#total-files").textContent = active.length;
  $("#total-size").textContent = size(
    active.reduce((sum, file) => sum + file.size, 0),
  );
  $("#file-count").textContent = active.length;
  const query = $("#search").value.toLocaleLowerCase().trim();
  const visible = selectFiles(active, now, query, $("#sort").value);
  const fragment = document.createDocumentFragment();
  for (const file of visible) {
    const row = createFileRow(file, now, toast);
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
