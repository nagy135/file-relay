import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { loadFiles } from "../lib/api";
import { CLOCK_TICK_MS, DASHBOARD_REFRESH_MS } from "../lib/config";
import { errorMessage } from "../lib/errors";
import type { RelayFile, Settings } from "../lib/types";

export function useDashboardFiles(settings: Settings, ready: boolean) {
  const [files, setFiles] = useState<RelayFile[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  const clockOffset = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const authenticated = !!settings.username && !!settings.password;

  const refresh = useCallback(async () => {
    if (
      !ready ||
      !settings.username ||
      !settings.password ||
      activeRequest.current
    )
      return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setRefreshing(true);
    try {
      const data = await loadFiles(settings, controller.signal);
      if (controller.signal.aborted) return;
      clockOffset.current = Date.parse(data.now) - Date.now();
      setClock(Date.now() + clockOffset.current);
      setFiles(data.files);
      setLoaded(true);
      setError("");
    } catch (error) {
      if (!controller.signal.aborted) setError(errorMessage(error));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setRefreshing(false);
      }
    }
  }, [ready, settings]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, DASHBOARD_REFRESH_MS);
    const tick = setInterval(() => {
      if (AppState.currentState === "active")
        setClock(Date.now() + clockOffset.current);
    }, CLOCK_TICK_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setClock(Date.now() + clockOffset.current);
        void refresh();
      }
    });
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      subscription.remove();
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refresh]);

  function reset() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setFiles([]);
    setLoaded(false);
    setError("");
    setRefreshing(false);
  }
  return {
    files,
    loaded,
    refreshing,
    error,
    clock,
    authenticated,
    refresh,
    reset,
  };
}
