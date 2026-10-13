import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../lib/config";
import { errorMessage } from "../lib/errors";
import { clearAbandonedSharedFiles } from "../lib/sharedFiles";
import { readSettings } from "../lib/storage";
import type { Settings } from "../lib/types";

export function useSettings(onError: (message: string) => void) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    void (async () => {
      await clearAbandonedSharedFiles().catch(() => {});
      try {
        const saved = await readSettings();
        if (mounted) setSettings(saved);
      } catch (error) {
        if (mounted) onError(errorMessage(error));
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [onError]);
  return { settings, setSettings, ready };
}
