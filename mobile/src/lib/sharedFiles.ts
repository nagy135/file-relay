import * as FileSystem from "expo-file-system/legacy";
import type { ResolvedSharePayload } from "expo-sharing";
import { MAX_FILE_SIZE } from "./config";
import { safeFilename } from "./files";
import type { QueueItem } from "./types";

export async function prepareSharedFile(
  payload: ResolvedSharePayload,
): Promise<QueueItem> {
  // Read each original URI: the resolver may reuse a cache path for two files
  // with identical names. Android grants read access to the original content URI.
  const source = /^(content:\/\/|file:\/)/.test(payload.value)
    ? payload.value
    : payload.contentUri;
  if (!source || !/^(content:\/\/|file:\/)/.test(source))
    throw new Error("Share an actual file, photo, or video from another app.");
  if (payload.contentSize !== null && payload.contentSize > MAX_FILE_SIZE)
    throw new Error(
      `${payload.originalName || "This file"} exceeds the 200 MB limit.`,
    );
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const name = safeFilename(payload.originalName);
  const directory = `${FileSystem.cacheDirectory}relay-incoming/${id}/`;
  const uri = `${directory}${encodeURIComponent(name)}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  try {
    await FileSystem.copyAsync({ from: source, to: uri });
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory)
      throw new Error(
        "The shared file could not be read. Try sharing it again.",
      );
    if (info.size > MAX_FILE_SIZE)
      throw new Error(`${name} exceeds the 200 MB limit.`);
    return {
      id,
      name,
      uri,
      directory,
      size: info.size,
      mimeType:
        payload.contentMimeType ||
        payload.mimeType ||
        "application/octet-stream",
      status: "ready",
      progress: 0,
    };
  } catch (error) {
    await FileSystem.deleteAsync(directory, { idempotent: true }).catch(
      () => {},
    );
    throw error;
  }
}

export async function removeCachedFile(item: QueueItem) {
  await FileSystem.deleteAsync(item.directory, { idempotent: true });
}

export async function clearAbandonedSharedFiles() {
  await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}relay-incoming`, {
    idempotent: true,
  });
}
