export function renderUploadResult(result, response) {
  const heading = document.createElement("h3");
  heading.textContent = "Your file is on its way.";
  const row = document.createElement("div");
  row.className = "link-row";
  const link = document.createElement("a");
  link.href = response.url;
  link.textContent = response.url;
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
    new Date(response.expires_at).toLocaleString() +
    ". Anyone with this link can download.";
  result.replaceChildren(heading, row, expiry);
  result.hidden = false;
}
