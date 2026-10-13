import { Text, View } from "react-native";
import { Button, Card, s } from "../ui";
import type { QueueItem } from "../../lib/types";
import { QueueItemCard } from "./QueueItemCard";
import { styles } from "./styles";

type Props = {
  items: QueueItem[];
  now: number;
  uploading: boolean;
  preparing: boolean;
  readyCount: number;
  onUpload: () => Promise<void>;
  onDismiss: (item: QueueItem) => Promise<void>;
  onRetry: (item: QueueItem) => void;
  onCopy: (url: string) => Promise<void>;
  onShare: (url: string) => Promise<void>;
};

export function UploadQueue({
  items,
  now,
  uploading,
  preparing,
  readyCount,
  onUpload,
  onDismiss,
  onRetry,
  onCopy,
  onShare,
}: Props) {
  if (!items.length) return null;
  return (
    <Card>
      <View style={s.between}>
        <Text style={s.title}>Shared with File Relay</Text>
        <Text style={styles.badge}>{items.length}</Text>
      </View>
      {items.map((item) => (
        <QueueItemCard
          key={item.id}
          item={item}
          now={now}
          uploading={uploading}
          onDismiss={onDismiss}
          onRetry={onRetry}
          onCopy={onCopy}
          onShare={onShare}
        />
      ))}
      {(readyCount > 0 || uploading) && (
        <>
          <Text style={s.body}>
            Uploading creates a public download link for each file.
          </Text>
          <Button
            primary
            label={
              uploading
                ? "Uploading…"
                : `Upload ${readyCount} ${readyCount === 1 ? "file" : "files"}`
            }
            icon="upload-cloud"
            disabled={uploading || preparing}
            onPress={() => {
              void onUpload();
            }}
          />
        </>
      )}
    </Card>
  );
}
