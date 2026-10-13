import { useTheme } from "../../theme/ThemeProvider";
import { Text, View } from "react-native";
import { formatSize } from "../../lib/format";

export function FileSummary({
  count,
  bytes,
  loaded,
}: {
  count: number;
  bytes: number;
  loaded: boolean;
}) {
  const { s, styles } = useTheme();
  return (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Text style={s.label}>Active files</Text>
        <Text style={styles.statValue}>{loaded ? count : "—"}</Text>
        <Text style={styles.statNote}>Available to download</Text>
      </View>
      <View style={styles.stat}>
        <Text style={s.label}>Total storage</Text>
        <Text style={styles.statValue}>{loaded ? formatSize(bytes) : "—"}</Text>
        <Text style={styles.statNote}>Across all active files</Text>
      </View>
    </View>
  );
}
