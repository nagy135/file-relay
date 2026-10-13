import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { useIncomingShare } from "expo-sharing";
import SettingsModal from "../components/SettingsModal";
import { Button, Card, colors, Icon, IconButton, s } from "../components/ui";
import { loadFiles } from "../lib/api";
import {
  DEFAULT_SETTINGS,
  formatDuration,
  formatSize,
  visibleFiles,
  type RelayFile,
  type Settings,
  type SortOrder,
} from "../lib/model";
import { readSettings } from "../lib/storage";
import {
  prepareSharedFile,
  removeCachedFile,
  uploadFile,
  UploadError,
  type QueueItem,
} from "../lib/uploads";

const sorts: [SortOrder, string][] = [
  ["newest", "Newest"],
  ["expiry", "Expiring"],
  ["size", "Largest"],
  ["name", "A–Z"],
];
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";

export default function Dashboard() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [booted, setBooted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [files, setFiles] = useState<RelayFile[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [preparing, setPreparing] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [inboxError, setInboxError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [clock, setClock] = useState(() => Date.now());
  const clockOffset = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const uploadLock = useRef(false);
  const handledPayloads = useRef<unknown>(null);
  const incoming = useIncomingShare();
  const { resolvedSharedPayloads, clearSharedPayloads, refreshSharePayloads } =
    incoming;
  const authenticated = !!settings.username && !!settings.password;

  useEffect(() => {
    let mounted = true;
    (async () => {
      // Copies from interrupted previous sessions are not referenced by a live queue.
      await FileSystem.deleteAsync(
        `${FileSystem.cacheDirectory}relay-incoming`,
        { idempotent: true },
      ).catch(() => {});
      try {
        const saved = await readSettings();
        if (mounted) setSettings(saved);
      } catch (err) {
        if (mounted) setInboxError(message(err));
      }
      if (mounted) setBooted(true);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (
      !booted ||
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
    } catch (err) {
      if (!controller.signal.aborted) setError(message(err));
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setRefreshing(false);
      }
    }
  }, [booted, settings]);

  useEffect(() => {
    void refresh();
    const poll = setInterval(() => {
      if (AppState.currentState === "active") void refresh();
    }, 15000);
    const tick = setInterval(() => {
      if (AppState.currentState === "active")
        setClock(Date.now() + clockOffset.current);
    }, 1000);
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

  useEffect(() => {
    const subscription = Linking.addEventListener("url", () =>
      refreshSharePayloads(),
    );
    return () => subscription.remove();
  }, [refreshSharePayloads]);

  useEffect(() => {
    if (
      !booted ||
      !resolvedSharedPayloads.length ||
      handledPayloads.current === resolvedSharedPayloads
    )
      return;
    handledPayloads.current = resolvedSharedPayloads;
    const payloads = [...resolvedSharedPayloads];
    clearSharedPayloads();
    refreshSharePayloads();
    setPreparing((count) => count + 1);
    setInboxError("");
    (async () => {
      const errors: string[] = [];
      for (const payload of payloads) {
        try {
          const item = await prepareSharedFile(payload);
          setQueue((old) => [...old, item]);
        } catch (err) {
          errors.push(message(err));
        }
      }
      if (errors.length) setInboxError(errors.join("\n"));
      setPreparing((count) => count - 1);
    })();
  }, [
    booted,
    resolvedSharedPayloads,
    clearSharedPayloads,
    refreshSharePayloads,
  ]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function copy(url: string) {
    try {
      await Clipboard.setStringAsync(url);
      setNotice("Download link copied");
    } catch (err) {
      setInboxError(message(err));
    }
  }
  async function share(url: string) {
    try {
      await Share.share({ message: url });
    } catch (err) {
      setInboxError(message(err));
    }
  }
  async function download(file: RelayFile) {
    try {
      await Linking.openURL(file.url);
    } catch (err) {
      setInboxError(message(err));
    }
  }
  const patch = (id: string, update: Partial<QueueItem>) =>
    setQueue((old) =>
      old.map((item) => (item.id === id ? { ...item, ...update } : item)),
    );
  async function upload() {
    if (uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    try {
      for (const item of queue.filter(
        (item) => item.status === "ready" || item.status === "error",
      )) {
        patch(item.id, { status: "uploading", error: undefined, progress: 0 });
        try {
          const result = await uploadFile(settings.baseUrl, item, (progress) =>
            patch(item.id, { progress }),
          );
          patch(item.id, { status: "done", progress: 1, result });
          await removeCachedFile(item).catch(() => {});
          void refresh();
        } catch (err) {
          const uncertain = err instanceof UploadError && err.uncertain;
          patch(item.id, {
            status: uncertain ? "uncertain" : "error",
            error: message(err),
          });
          if (uncertain) {
            void refresh();
            break;
          }
        }
      }
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  }
  async function dismiss(item: QueueItem) {
    try {
      await removeCachedFile(item);
      setQueue((old) => old.filter((value) => value.id !== item.id));
    } catch (err) {
      setInboxError(message(err));
    }
  }

  const active = visibleFiles(files, clock, "", "newest");
  const visible = visibleFiles(files, clock, query, sort);
  const ready = queue.filter(
    (item) => item.status === "ready" || item.status === "error",
  ).length;
  const actions = (url: string) => (
    <View style={s.row}>
      <Button
        label="Copy link"
        icon="copy"
        small
        onPress={() => {
          void copy(url);
        }}
      />
      <Button
        label="Share link"
        icon="share-2"
        small
        onPress={() => {
          void share(url);
        }}
      />
    </View>
  );

  return (
    <SafeAreaView
      style={styles.page}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.topbar}>
        <View style={s.row}>
          <View style={styles.mark}>
            <Icon name="arrow-up-right" color="#FFF" size={24} />
          </View>
          <Text style={styles.brand}>file relay</Text>
        </View>
        <IconButton
          label="Open settings"
          icon="settings"
          disabled={uploading}
          onPress={() => setShowSettings(true)}
        />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 18 }}>
            <View>
              <Text style={styles.eyebrow}>YOUR RELAY, AT A GLANCE</Text>
              <Text style={styles.heading}>Everything in transit.</Text>
              <Text style={s.body}>Small stop. Next destination.</Text>
            </View>
            <View style={styles.intake}>
              <View style={styles.intakeIcon}>
                <Icon name="share-2" size={23} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.title}>Share it here.</Text>
                <Text style={s.body}>
                  In Files, Photos, or another app, tap Share → File Relay. Any
                  file type, up to 200 MB.
                </Text>
              </View>
            </View>
            {(incoming.isResolving || preparing > 0) && (
              <View style={s.row}>
                <ActivityIndicator color={colors.accent} />
                <Text style={s.body}>Preparing shared files…</Text>
              </View>
            )}
            {!!(inboxError || incoming.error) && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                onPress={() => {
                  setInboxError("");
                  clearSharedPayloads();
                  refreshSharePayloads();
                }}
              >
                <Text accessibilityRole="alert" style={s.error}>
                  {inboxError || incoming.error?.message}
                </Text>
              </Pressable>
            )}
            {queue.length > 0 && (
              <Card>
                <View style={s.between}>
                  <Text style={s.title}>Shared with File Relay</Text>
                  <Text style={styles.badge}>{queue.length}</Text>
                </View>
                {queue.map((item) => (
                  <View key={item.id} style={styles.queueItem}>
                    <View style={s.between}>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text numberOfLines={2} style={styles.filename}>
                          {item.name}
                        </Text>
                        <Text style={s.body}>
                          {formatSize(item.size)} ·{" "}
                          {item.status === "done"
                            ? "Link ready"
                            : item.status === "uploading"
                              ? `Uploading ${Math.round(item.progress * 100)}%`
                              : item.status === "ready"
                                ? "Ready to upload"
                                : "Needs attention"}
                        </Text>
                      </View>
                      <IconButton
                        label={`Remove ${item.name}`}
                        icon="x"
                        disabled={uploading}
                        onPress={() => {
                          void dismiss(item);
                        }}
                      />
                    </View>
                    {item.status === "uploading" && (
                      <View style={s.progress}>
                        <View
                          style={{
                            height: 5,
                            width: `${item.progress * 100}%`,
                            backgroundColor: colors.accent,
                          }}
                        />
                      </View>
                    )}
                    {!!item.error && <Text style={s.error}>{item.error}</Text>}
                    {item.result && (
                      <>
                        <Text style={s.body}>
                          Expires{" "}
                          {new Date(item.result.expires_at).toLocaleString()}
                        </Text>
                        {Date.parse(item.result.expires_at) > clock ? (
                          actions(item.result.url)
                        ) : (
                          <Text style={s.body}>This link has expired.</Text>
                        )}
                      </>
                    )}
                    {item.status === "uncertain" && (
                      <Button
                        label="Send again"
                        small
                        disabled={uploading}
                        onPress={() =>
                          Alert.alert(
                            "Send another copy?",
                            "The previous upload may have completed. Check the dashboard first to avoid duplicate files.",
                            [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Send again",
                                onPress: () =>
                                  patch(item.id, {
                                    status: "ready",
                                    error: undefined,
                                  }),
                              },
                            ],
                          )
                        }
                      />
                    )}
                  </View>
                ))}
                {(ready > 0 || uploading) && (
                  <>
                    <Text style={s.body}>
                      Uploading creates a public download link for each file.
                    </Text>
                    <Button
                      primary
                      label={
                        uploading
                          ? "Uploading…"
                          : `Upload ${ready} ${ready === 1 ? "file" : "files"}`
                      }
                      icon="upload-cloud"
                      disabled={uploading || preparing > 0}
                      onPress={() => {
                        void upload();
                      }}
                    />
                  </>
                )}
              </Card>
            )}
            {!authenticated ? (
              <Card>
                <View style={s.row}>
                  <Icon name="lock" />
                  <Text style={s.title}>Your private dashboard</Text>
                </View>
                <Text style={s.body}>
                  Connect with your dashboard credentials to see all active
                  files. Shared-file uploads are ready to use.
                </Text>
                <Button
                  label="Connect dashboard"
                  icon="arrow-right"
                  disabled={uploading}
                  onPress={() => setShowSettings(true)}
                />
              </Card>
            ) : (
              <>
                <View style={styles.stats}>
                  <View style={styles.stat}>
                    <Text style={s.label}>Active files</Text>
                    <Text style={styles.statValue}>
                      {loaded ? active.length : "—"}
                    </Text>
                    <Text style={styles.statNote}>Available to download</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={s.label}>Total storage</Text>
                    <Text style={styles.statValue}>
                      {loaded
                        ? formatSize(
                            active.reduce((sum, item) => sum + item.size, 0),
                          )
                        : "—"}
                    </Text>
                    <Text style={styles.statNote}>Across all active files</Text>
                  </View>
                </View>
                {!!error && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {error}
                  </Text>
                )}
                <View style={s.between}>
                  <Text style={s.title}>
                    Active files{" "}
                    <Text style={{ color: colors.muted }}>
                      · {active.length}
                    </Text>
                  </Text>
                  <IconButton
                    label="Refresh files"
                    icon="refresh-cw"
                    disabled={refreshing}
                    onPress={() => {
                      void refresh();
                    }}
                  />
                </View>
                <View style={styles.search}>
                  <Icon name="search" color={colors.muted} size={18} />
                  <TextInput
                    accessibilityLabel="Search active files"
                    placeholder="Search files…"
                    placeholderTextColor={colors.muted}
                    value={query}
                    onChangeText={setQuery}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontSize: 14,
                      paddingVertical: 12,
                    }}
                    autoCorrect={false}
                  />
                  <IconButton
                    label="Clear search"
                    icon="x"
                    onPress={() => setQuery("")}
                  />
                </View>
                <View style={styles.sorts}>
                  {sorts.map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`Sort ${label}`}
                      accessibilityState={{ selected: sort === value }}
                      onPress={() => setSort(value)}
                      style={[
                        styles.sort,
                        value === sort && styles.selectedSort,
                      ]}
                    >
                      <Text
                        style={{
                          color: sort === value ? colors.accent : colors.muted,
                          fontWeight: "600",
                          fontSize: 12,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FileCard
            file={item}
            now={clock}
            copy={() => {
              void copy(item.url);
            }}
            share={() => {
              void share(item.url);
            }}
            download={() => {
              void download(item);
            }}
          />
        )}
        ListEmptyComponent={
          authenticated ? (
            <View style={styles.empty}>
              <Icon
                name={error ? "wifi-off" : "inbox"}
                size={28}
                color={colors.muted}
              />
              <Text style={s.title}>
                {!loaded
                  ? error
                    ? "Files are unavailable"
                    : "Loading your files…"
                  : query
                    ? "No matching files"
                    : "Nothing in transit. Yet."}
              </Text>
              <Text style={[s.body, { textAlign: "center" }]}>
                {!loaded
                  ? "Checking what’s in transit."
                  : query
                    ? "Try another file name or clear your search."
                    : "Share a file to File Relay and upload it here."}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {authenticated && (
              <Text style={styles.statNote}>
                {loaded
                  ? `Showing ${visible.length} of ${active.length} files`
                  : "Connecting…"}{" "}
                · {error ? "Retrying automatically" : "Updates every 15s"}
              </Text>
            )}
            <Text style={styles.statNote}>
              Files disappear when their links expire.{"\n"}Downloading does not
              extend their lifetime.
            </Text>
            <Text style={{ ...s.body, fontWeight: "600" }}>
              Temporary by design ↗
            </Text>
          </View>
        }
      />
      {!!notice && (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <Text style={{ color: "#FFF", fontSize: 14 }}>{notice}</Text>
        </View>
      )}
      {showSettings && (
        <SettingsModal
          initial={settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            setFiles([]);
            setLoaded(false);
            setError("");
            setRefreshing(false);
            setSettings(next);
            setShowSettings(false);
            setNotice("Connection saved");
          }}
        />
      )}
    </SafeAreaView>
  );
}

function FileCard({
  file,
  now,
  copy,
  share,
  download,
}: {
  file: RelayFile;
  now: number;
  copy: () => void;
  share: () => void;
  download: () => void;
}) {
  const remaining = Math.max(0, Date.parse(file.expires_at) - now);
  const lifetime = Date.parse(file.expires_at) - Date.parse(file.uploaded_at);
  const fraction =
    lifetime > 0 ? Math.max(0, Math.min(1, remaining / lifetime)) : 0;
  const extension = file.filename.includes(".")
    ? file.filename.split(".").pop()?.slice(0, 4).toUpperCase()
    : "FILE";
  return (
    <View style={{ marginTop: 12 }}>
      <Card>
        <View style={s.row}>
          <View style={styles.fileIcon}>
            <Text
              style={{ color: colors.accent, fontSize: 10, fontWeight: "700" }}
            >
              {extension || "FILE"}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.filename} numberOfLines={2}>
              {file.filename}
            </Text>
            <Text style={styles.statNote}>
              {formatSize(file.size)} · Uploaded{" "}
              {new Date(file.uploaded_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
        <View style={{ gap: 8 }}>
          <View style={s.between}>
            <Text
              style={{
                color: remaining < 600000 ? colors.red : colors.green,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {formatDuration(remaining)} left
            </Text>
            <Text style={styles.statNote}>of {formatDuration(lifetime)}</Text>
          </View>
          <View
            accessibilityLabel={`Lifetime remaining for ${file.filename}`}
            style={s.progress}
          >
            <View
              style={{
                height: 5,
                width: `${fraction * 100}%`,
                backgroundColor:
                  remaining < 600000 ? colors.red : colors.accent,
              }}
            />
          </View>
        </View>
        <View style={s.between}>
          <View style={s.row}>
            <Button label="Copy" icon="copy" small onPress={copy} />
            <Button label="Share" icon="share-2" small onPress={share} />
          </View>
          <IconButton
            label={`Download ${file.filename}`}
            icon="download"
            onPress={download}
          />
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  mark: {
    height: 32,
    width: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: colors.ink,
  },
  content: {
    padding: 22,
    paddingBottom: 30,
    maxWidth: 760,
    width: "100%",
    alignSelf: "center",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 8,
  },
  intake: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    backgroundColor: colors.soft,
    borderRadius: 18,
    padding: 18,
  },
  intakeIcon: {
    height: 46,
    width: 46,
    borderRadius: 14,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: colors.soft,
    color: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: "700",
  },
  queueItem: {
    borderTopWidth: 1,
    borderColor: colors.line,
    paddingTop: 12,
    gap: 10,
  },
  filename: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  stats: { flexDirection: "row", gap: 12 },
  stat: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: "#FFF",
    gap: 8,
  },
  statValue: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.8,
  },
  statNote: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#FFF",
    paddingLeft: 14,
    paddingRight: 3,
  },
  sorts: { flexDirection: "row", gap: 6 },
  sort: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: "#FFF",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
  },
  selectedSort: { backgroundColor: colors.soft, borderColor: "#D5CEF7" },
  empty: { paddingVertical: 36, alignItems: "center", gap: 12 },
  fileIcon: {
    width: 42,
    height: 46,
    borderRadius: 10,
    backgroundColor: colors.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { marginTop: 24, gap: 12, alignItems: "center", paddingBottom: 20 },
  toast: {
    position: "absolute",
    bottom: 32,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.ink,
  },
});
