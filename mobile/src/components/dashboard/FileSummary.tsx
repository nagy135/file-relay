import { Text, View } from "react-native";
import { formatSize } from "../../lib/format";
import { s } from "../ui";
import { styles } from "./styles";

export function FileSummary({
  count,
  bytes,
  loaded,
}: {
  count: number;
  bytes: number;
  loaded: boolean;
}) {
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
