import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SettingsModal from "../components/SettingsModal";
import { colors, s } from "../components/ui";
import { ConnectionPrompt } from "../components/dashboard/ConnectionPrompt";
import { DashboardIntro } from "../components/dashboard/DashboardIntro";
import FileCard from "../components/dashboard/FileCard";
import { FileControls } from "../components/dashboard/FileControls";
import {
  EmptyFiles,
  FileListFooter,
} from "../components/dashboard/FileListStatus";
import { FileSummary } from "../components/dashboard/FileSummary";
import { TopBar } from "../components/dashboard/TopBar";
import { UploadQueue } from "../components/dashboard/UploadQueue";
import { styles } from "../components/dashboard/styles";
import { useDashboardFiles } from "../hooks/useDashboardFiles";
import { useFeedback } from "../hooks/useFeedback";
import { useLinkActions } from "../hooks/useLinkActions";
import { useSettings } from "../hooks/useSettings";
import { useShareQueue } from "../hooks/useShareQueue";
import { visibleFiles } from "../lib/files";
import type { SortOrder } from "../lib/types";

export default function Dashboard() {
  const feedback = useFeedback();
  const session = useSettings(feedback.setError);
  const dashboard = useDashboardFiles(session.settings, session.ready);
  const queue = useShareQueue(
    session.ready,
    session.settings.baseUrl,
    dashboard.refresh,
    feedback.setError,
  );
  const links = useLinkActions(feedback.setNotice, feedback.setError);
  const [showSettings, setShowSettings] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const active = visibleFiles(dashboard.files, dashboard.clock, "", "newest");
  const visible = visibleFiles(dashboard.files, dashboard.clock, query, sort);
  const inboxError = feedback.error || queue.error;

  return (
    <SafeAreaView
      style={styles.page}
      edges={["top", "left", "right", "bottom"]}
    >
      <TopBar
        disabled={queue.uploading}
        onSettings={() => setShowSettings(true)}
      />
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={dashboard.refreshing}
            onRefresh={() => {
              void dashboard.refresh();
            }}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 18 }}>
            <DashboardIntro />
            {queue.preparing && (
              <View style={s.row}>
                <ActivityIndicator color={colors.accent} />
                <Text style={s.body}>Preparing shared files…</Text>
              </View>
            )}
            {!!inboxError && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                onPress={queue.clearError}
              >
                <Text accessibilityRole="alert" style={s.error}>
                  {inboxError}
                </Text>
              </Pressable>
            )}
            <UploadQueue
              items={queue.items}
              now={dashboard.clock}
              uploading={queue.uploading}
              preparing={queue.preparing}
              readyCount={queue.readyCount}
              onUpload={queue.upload}
              onDismiss={queue.dismiss}
              onRetry={queue.retry}
              onCopy={links.copy}
              onShare={links.share}
            />
            {!dashboard.authenticated ? (
              <ConnectionPrompt
                disabled={queue.uploading}
                onConnect={() => setShowSettings(true)}
              />
            ) : (
              <>
                <FileSummary
                  count={active.length}
                  bytes={active.reduce((sum, item) => sum + item.size, 0)}
                  loaded={dashboard.loaded}
                />
                {!!dashboard.error && (
                  <Text accessibilityRole="alert" style={s.error}>
                    {dashboard.error}
                  </Text>
                )}
                <FileControls
                  count={active.length}
                  refreshing={dashboard.refreshing}
                  query={query}
                  sort={sort}
                  onRefresh={dashboard.refresh}
                  onQueryChange={setQuery}
                  onSortChange={setSort}
                />
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <FileCard
            file={item}
            now={dashboard.clock}
            copy={() => {
              void links.copy(item.url);
            }}
            share={() => {
              void links.share(item.url);
            }}
            download={() => {
              void links.download(item.url);
            }}
          />
        )}
        ListEmptyComponent={
          dashboard.authenticated ? (
            <EmptyFiles
              loaded={dashboard.loaded}
              error={dashboard.error}
              query={query}
            />
          ) : null
        }
        ListFooterComponent={
          <FileListFooter
            authenticated={dashboard.authenticated}
            loaded={dashboard.loaded}
            visibleCount={visible.length}
            activeCount={active.length}
            error={dashboard.error}
          />
        }
      />
      {!!feedback.notice && (
        <View accessibilityLiveRegion="polite" style={styles.toast}>
          <Text style={{ color: "#FFF", fontSize: 14 }}>{feedback.notice}</Text>
        </View>
      )}
      {showSettings && (
        <SettingsModal
          initial={session.settings}
          onClose={() => setShowSettings(false)}
          onSave={(next) => {
            dashboard.reset();
            session.setSettings(next);
            setShowSettings(false);
            feedback.setNotice("Connection saved");
          }}
        />
      )}
    </SafeAreaView>
  );
}
