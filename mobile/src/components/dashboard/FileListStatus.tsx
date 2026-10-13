import { Text, View } from "react-native";
import { colors, Icon, s } from "../ui";
import { styles } from "./styles";

export function EmptyFiles({
  loaded,
  error,
  query,
}: {
  loaded: boolean;
  error: string;
  query: string;
}) {
  return (
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
  );
}

export function FileListFooter({
  authenticated,
  loaded,
  visibleCount,
  activeCount,
  error,
}: {
  authenticated: boolean;
  loaded: boolean;
  visibleCount: number;
  activeCount: number;
  error: string;
}) {
  return (
    <View style={styles.footer}>
      {authenticated && (
        <Text style={styles.statNote}>
          {loaded
            ? `Showing ${visibleCount} of ${activeCount} files`
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
  );
}
