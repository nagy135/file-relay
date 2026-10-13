import { basicAuth } from "./connection";
import type { RelayFile, Settings } from "./types";

export async function loadFiles(
  settings: Settings,
  signal?: AbortSignal,
): Promise<{ files: RelayFile[]; now: string }> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", cancel);
  const timeout = setTimeout(cancel, 10000);
  try {
    const response = await fetch(`${settings.baseUrl}/api/files`, {
      headers: {
        Authorization: basicAuth(settings),
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new Error(
        response.status === 401
          ? "Incorrect dashboard username or password. Update Settings to reconnect."
          : response.status === 503
            ? "The dashboard is unavailable. Check its server configuration."
            : `Could not load files (HTTP ${response.status}).`,
      );
    const data = await response.json();
    if (!Array.isArray(data.files) || !Number.isFinite(Date.parse(data.now)))
      throw new Error("The server returned an invalid dashboard response.");
    for (const file of data.files) {
      if (
        typeof file.id !== "string" ||
        typeof file.filename !== "string" ||
        !Number.isFinite(file.size) ||
        file.size < 0 ||
        !Number.isFinite(Date.parse(file.uploaded_at)) ||
        !Number.isFinite(Date.parse(file.expires_at)) ||
        !["http:", "https:"].includes(new URL(file.url).protocol)
      )
        throw new Error("The server returned invalid file metadata.");
    }
    return data;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", cancel);
  }
}
