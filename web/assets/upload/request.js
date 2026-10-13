export function sendFile(file, { onProgress, onSuccess, onError, onComplete }) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/upload");
  xhr.responseType = "json";
  xhr.timeout = 30 * 60 * 1000;
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
  };
  xhr.onload = () => {
    if (xhr.status !== 201) {
      onError(xhr.response?.error || `Upload failed (${xhr.status}).`);
      return;
    }
    onSuccess(xhr.response);
  };
  xhr.onerror = () =>
    onError("Upload failed. Check your connection and try again.");
  xhr.ontimeout = () => onError("Upload timed out. Try again.");
  xhr.onloadend = onComplete;
  const body = new FormData();
  body.append("file", file);
  xhr.send(body);
}
