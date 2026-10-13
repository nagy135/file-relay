export type Settings = { baseUrl: string; username: string; password: string };
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
