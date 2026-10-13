import { Text, View } from "react-native";
import { Button, Card, colors, IconButton, s } from "../ui";
import { formatDuration, formatSize } from "../../lib/format";
import type { RelayFile } from "../../lib/types";
import { styles } from "./styles";

export default function FileCard({
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
