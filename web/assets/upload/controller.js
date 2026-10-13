import { $ } from "../shared/dom.js";
import { formatSize } from "../shared/format.js";
import { sendFile } from "./request.js";
import { renderUploadResult } from "./result.js";

export function startUpload() {
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
    $("#file-note").textContent = `${formatSize(file.size)} · Ready to send`;
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
    sendFile(selectedFile, {
      onProgress: (percentage) => {
        $("#progress").value = percentage;
        $("#progress-label").textContent =
          percentage >= 100 ? "Finishing…" : `${Math.round(percentage)}%`;
      },
      onSuccess: (response) => renderUploadResult(result, response),
      onError: (message) => {
        error.textContent = message;
        error.hidden = false;
      },
      onComplete: () => {
        uploading = false;
        button.disabled = input.disabled = false;
        $("#upload-progress").hidden = true;
      },
    });
  });
}
