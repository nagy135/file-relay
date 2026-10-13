import { useTheme } from "../../theme/ThemeProvider";
import { Alert, Text, View } from "react-native";
import { Button, IconButton } from "../ui";
import { formatSize } from "../../lib/format";
import type { QueueItem } from "../../lib/types";
import { LinkActions } from "./LinkActions";

export function QueueItemCard({
  item,
  now,
  uploading,
  onDismiss,
  onRetry,
  onCopy,
  onShare,
}: {
  item: QueueItem;
  now: number;
  uploading: boolean;
  onDismiss: (item: QueueItem) => Promise<void>;
  onRetry: (item: QueueItem) => void;
  onCopy: (url: string) => Promise<void>;
  onShare: (url: string) => Promise<void>;
}) {
  const { colors, s, styles } = useTheme();
  return (
    <View style={styles.queueItem}>
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
            void onDismiss(item);
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
            Expires {new Date(item.result.expires_at).toLocaleString()}
          </Text>
          {Date.parse(item.result.expires_at) > now ? (
            <LinkActions
              url={item.result.url}
              onCopy={onCopy}
              onShare={onShare}
            />
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
                  onPress: () => onRetry(item),
                },
              ],
            )
          }
        />
      )}
    </View>
  );
}
