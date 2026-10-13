import { useTheme } from "../../theme/ThemeProvider";
import { Text, View } from "react-native";
import { Icon, IconButton } from "../ui";

export function TopBar({
  disabled,
  onSettings,
}: {
  disabled: boolean;
  onSettings: () => void;
}) {
  const { colors, s, styles } = useTheme();
  return (
    <View style={styles.topbar}>
      <View style={s.row}>
        <View style={styles.mark}>
          <Icon name="arrow-up-right" color={colors.onPrimary} size={24} />
        </View>
        <Text style={styles.brand}>file relay</Text>
      </View>
      <IconButton
        label="Open settings"
        icon="settings"
        disabled={disabled}
        onPress={onSettings}
      />
    </View>
  );
}
