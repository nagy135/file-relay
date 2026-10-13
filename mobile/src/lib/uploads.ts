import * as FileSystem from "expo-file-system/legacy";
import type { ResolvedSharePayload } from "expo-sharing";
import {
  isUploadResult,
  MAX_FILE_SIZE,
  safeFilename,
  type UploadResult,
} from "./model";

export type QueueItem = {
  id: string;
  name: string;
  uri: string;
  directory: string;
  mimeType: string;
  size: number;
  status: "ready" | "uploading" | "done" | "error" | "uncertain";
  progress: number;
  error?: string;
  result?: UploadResult;
};
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

export class UploadError extends Error {
  constructor(
    message: string,
    public uncertain = false,
  ) {
    super(message);
  }
}

export async function uploadFile(
  baseUrl: string,
  item: QueueItem,
  onProgress: (value: number) => void,
): Promise<UploadResult> {
  const task = FileSystem.createUploadTask(
    `${baseUrl}/upload`,
    item.uri,
    {
      httpMethod: "POST",
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: "file",
      mimeType: item.mimeType,
    },
    (event) => {
      onProgress(
        event.totalBytesExpectedToSend
          ? Math.min(
              0.99,
              event.totalBytesSent / event.totalBytesExpectedToSend,
            )
          : 0,
      );
    },
  );
  let response;
  try {
    response = await task.uploadAsync();
  } catch {
    throw new UploadError(
      "Connection lost. The file may have uploaded. Check the dashboard before sending it again.",
      true,
    );
  }
  if (!response)
    throw new UploadError(
      "Upload interrupted. Check the dashboard before sending it again.",
      true,
    );
  if (response.status !== 201)
    throw new UploadError(
      response.status === 413
        ? "This file exceeds the 200 MB limit."
        : response.status === 503
          ? "The relay is busy. Try again in a moment."
          : `Upload failed (HTTP ${response.status}).`,
    );
  let result: unknown;
  try {
    result = JSON.parse(response.body);
  } catch {
    throw new UploadError(
      "The server accepted the file but returned an unreadable link. Check the dashboard.",
      true,
    );
  }
  if (!isUploadResult(result, item.size))
    throw new UploadError(
      "The server accepted the file but returned invalid metadata. Check the dashboard.",
      true,
    );
  return result;
}

export async function removeCachedFile(item: QueueItem) {
  await FileSystem.deleteAsync(item.directory, { idempotent: true });
}
