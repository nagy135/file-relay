import { useEffect, useRef, useState } from "react";
import { Linking } from "react-native";
import { useIncomingShare } from "expo-sharing";
import { errorMessage } from "../lib/errors";
import { prepareSharedFile, removeCachedFile } from "../lib/sharedFiles";
import type { QueueItem } from "../lib/types";
import { uploadFile, UploadError } from "../lib/uploads";

export function useShareQueue(
  ready: boolean,
  baseUrl: string,
  onUploaded: () => Promise<void>,
  onError: (message: string) => void,
  defaultExpiresIn: number,
) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [expiryOverride, setExpiryOverride] = useState<number | null>(null);
  const expiresIn = expiryOverride ?? defaultExpiresIn;
  const uploadLock = useRef(false);
  const handledPayloads = useRef<unknown>(null);
  const incoming = useIncomingShare();
  const { resolvedSharedPayloads, clearSharedPayloads, refreshSharePayloads } =
    incoming;

  useEffect(() => {
    const subscription = Linking.addEventListener("url", () =>
      refreshSharePayloads(),
    );
    return () => subscription.remove();
  }, [refreshSharePayloads]);

  useEffect(() => {
    if (
      !ready ||
      !resolvedSharedPayloads.length ||
      handledPayloads.current === resolvedSharedPayloads
    )
      return;
    handledPayloads.current = resolvedSharedPayloads;
    const payloads = [...resolvedSharedPayloads];
    clearSharedPayloads();
    refreshSharePayloads();
    setPreparing((count) => count + 1);
    onError("");
    void (async () => {
      const errors: string[] = [];
      for (const payload of payloads) {
        try {
          const item = await prepareSharedFile(payload);
          setItems((old) => [...old, item]);
        } catch (error) {
          errors.push(errorMessage(error));
        }
      }
      if (errors.length) onError(errors.join("\n"));
      setPreparing((count) => count - 1);
    })();
  }, [
    ready,
    resolvedSharedPayloads,
    clearSharedPayloads,
    refreshSharePayloads,
    onError,
  ]);

  const patch = (id: string, update: Partial<QueueItem>) =>
    setItems((old) =>
      old.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  async function upload() {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    let failed = false;
    try {
      for (const item of items.filter(
        (item) => item.status === "ready" || item.status === "error",
      )) {
        patch(item.id, { status: "uploading", error: undefined, progress: 0 });
        try {
          const result = await uploadFile(
            baseUrl,
            item,
            (progress) => patch(item.id, { progress }),
            expiresIn,
          );
          patch(item.id, { status: "done", progress: 1, result });
          await removeCachedFile(item).catch(() => {});
          void onUploaded();
        } catch (error) {
          failed = true;
          const uncertain = error instanceof UploadError && error.uncertain;
          patch(item.id, {
            status: uncertain ? "uncertain" : "error",
            error: errorMessage(error),
          });
          if (uncertain) {
            void onUploaded();
            break;
          }
        }
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
      if (!failed) setExpiryOverride(null);
    }
  }
  async function dismiss(item: QueueItem) {
    try {
      await removeCachedFile(item);
      setItems((old) => old.filter((value) => value.id !== item.id));
      if (items.length === 1) setExpiryOverride(null);
    } catch (error) {
      onError(errorMessage(error));
    }
  }
  function retry(item: QueueItem) {
    patch(item.id, { status: "ready", error: undefined });
  }
  function clearError() {
    onError("");
    clearSharedPayloads();
    refreshSharePayloads();
  }
  return {
    items,
    expiresIn,
    setExpiresIn: setExpiryOverride,
    uploading,
    preparing: incoming.isResolving || preparing > 0,
    readyCount: items.filter(
      (item) => item.status === "ready" || item.status === "error",
    ).length,
    error: incoming.error?.message,
    upload,
    dismiss,
    retry,
    clearError,
  };
}
