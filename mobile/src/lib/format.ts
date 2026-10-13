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
