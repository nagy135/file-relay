import type { RelayFile, SortOrder, UploadResult } from "./types";

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
