import * as FileSystem from "expo-file-system/legacy";
import { isUploadResult } from "./files";
import type { QueueItem, UploadResult } from "./types";

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
