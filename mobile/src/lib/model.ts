export const MAX_FILE_SIZE = 200_000_000;
export const DEFAULT_URL = "https://relay.infiniter.tech";
export type Settings = { baseUrl: string; username: string; password: string };
export const DEFAULT_SETTINGS: Settings = {
  baseUrl: DEFAULT_URL,
  username: "",
  password: "",
};
export type RelayFile = {
  id: string;
  url: string;
  filename: string;
  size: number;
  uploaded_at: string;
  expires_at: string;
};
export type UploadResult = Omit<RelayFile, "id">;
export type SortOrder = "newest" | "expiry" | "size" | "name";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  const local =
    /^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(
      url.hostname,
    );
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    throw new Error(
      "Use an HTTPS relay URL. HTTP is allowed only for local development.",
    );
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname.replace(/\/+$/, "")
  )
    throw new Error(
      "Enter only the relay origin, for example https://relay.infiniter.tech.",
    );
  return url.origin;
}

export function basicAuth(settings: Settings): string {
  const utf8 = encodeURIComponent(
    `${settings.username}:${settings.password}`,
  ).replace(/%([0-9A-F]{2})/g, (_, hex: string) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
  return `Basic ${btoa(utf8)}`;
}

export function formatSize(bytes: number): string {
  return bytes < 1000
    ? `${bytes} B`
    : bytes < 1e6
      ? `${(bytes / 1000).toFixed(1)} KB`
      : `${(bytes / 1e6).toFixed(1)} MB`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (seconds >= 86400)
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
  if (seconds >= 3600)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function visibleFiles(
  files: RelayFile[],
  now: number,
  query: string,
  sort: SortOrder,
): RelayFile[] {
  const compare = {
    newest: (a: RelayFile, b: RelayFile) =>
      Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at),
    expiry: (a: RelayFile, b: RelayFile) =>
      Date.parse(a.expires_at) - Date.parse(b.expires_at),
    size: (a: RelayFile, b: RelayFile) => b.size - a.size,
    name: (a: RelayFile, b: RelayFile) => a.filename.localeCompare(b.filename),
  };
  return files
    .filter(
      (f) =>
        Date.parse(f.expires_at) > now &&
        f.filename
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort(compare[sort]);
}

export function safeFilename(name: string | null): string {
  const clean = (name || "shared-file").replace(/[\/\\\x00-\x1F\x7F]/g, "_");
  return clean === "." || clean === ".." ? "shared-file" : clean;
}

export function isUploadResult(
  value: unknown,
  size: number,
): value is UploadResult {
  if (!value || typeof value !== "object") return false;
  const result = value as UploadResult;
  try {
    return (
      ["https:", "http:"].includes(new URL(result.url).protocol) &&
      typeof result.filename === "string" &&
      result.size === size &&
      Number.isFinite(Date.parse(result.uploaded_at)) &&
      Date.parse(result.expires_at) > Date.parse(result.uploaded_at)
    );
  } catch {
    return false;
  }
}
