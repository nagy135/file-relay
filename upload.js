"use strict";
const $ = (selector) => document.querySelector(selector);
const form = $("#upload"),
  input = $("#file"),
  button = $("#submit"),
  result = $("#result"),
  error = $("#error");
let selectedFile,
  uploading = false;
$("#endpoint").textContent = location.origin;
function selectFile(file) {
  selectedFile = file;
  if (!file) return;
  $("#file-title").textContent = file.name;
  $("#file-note").textContent =
    `${file.size < 1000 ? file.size + " B" : file.size < 1e6 ? (file.size / 1000).toFixed(1) + " KB" : (file.size / 1e6).toFixed(1) + " MB"} · Ready to send`;
  error.hidden = true;
  result.hidden = true;
  if (file.size > 200000000) {
    error.textContent =
      "This file exceeds the 200 MB limit. Choose a smaller file.";
    error.hidden = false;
  }
}
input.addEventListener("change", () => selectFile(input.files[0]));
for (const type of ["dragenter", "dragover"])
  $("#dropzone").addEventListener(type, (event) => {
    event.preventDefault();
    if (!uploading) $("#dropzone").classList.add("dragging");
  });
for (const type of ["dragleave", "drop"])
  $("#dropzone").addEventListener(type, (event) => {
    event.preventDefault();
    $("#dropzone").classList.remove("dragging");
  });
$("#dropzone").addEventListener("drop", (event) => {
  if (uploading) return;
  if (event.dataTransfer.files.length !== 1) {
    error.textContent = "Please drop one file at a time.";
    error.hidden = false;
    return;
  }
  input.files = event.dataTransfer.files;
  selectFile(input.files[0]);
});
form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (uploading || !selectedFile || selectedFile.size > 200000000) return;
  uploading = true;
  button.disabled = input.disabled = true;
  error.hidden = result.hidden = true;
  $("#upload-progress").hidden = false;
  $("#progress").value = 0;
  $("#progress-label").textContent = "0%";
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload");
  xhr.responseType = "json";
  xhr.timeout = 30 * 60 * 1000;
  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const percentage = (event.loaded / event.total) * 100;
    $("#progress").value = percentage;
    $("#progress-label").textContent =
      percentage >= 100 ? "Finishing…" : `${Math.round(percentage)}%`;
  };
  const fail = (message) => {
    error.textContent = message;
    error.hidden = false;
  };
  xhr.onload = () => {
    if (xhr.status !== 201) {
      fail(xhr.response?.error || `Upload failed (${xhr.status}).`);
      return;
    }
    const heading = document.createElement("h3");
    heading.textContent = "Your file is on its way.";
    const row = document.createElement("div");
    row.className = "link-row";
    const link = document.createElement("a");
    link.href = xhr.response.url;
    link.textContent = xhr.response.url;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "button";
    copy.textContent = "Copy link";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(link.href);
        copy.textContent = "Copied!";
      } catch {
        copy.textContent = "Select link to copy";
      }
      setTimeout(() => {
        copy.textContent = "Copy link";
      }, 2500);
    });
    row.append(link, copy);
    const expiry = document.createElement("p");
    expiry.textContent =
      "Available until " +
      new Date(xhr.response.expires_at).toLocaleString() +
      ". Anyone with this link can download.";
    result.replaceChildren(heading, row, expiry);
    result.hidden = false;
  };
  xhr.onerror = () =>
    fail("Upload failed. Check your connection and try again.");
  xhr.ontimeout = () => fail("Upload timed out. Try again.");
  xhr.onloadend = () => {
    uploading = false;
    button.disabled = input.disabled = false;
    $("#upload-progress").hidden = true;
  };
  const body = new FormData();
  body.append("file", selectedFile);
  xhr.send(body);
});
