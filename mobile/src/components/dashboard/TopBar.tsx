import { Text, View } from "react-native";
import { Icon, IconButton, s } from "../ui";
import { styles } from "./styles";

export function TopBar({
  disabled,
  onSettings,
}: {
  disabled: boolean;
  onSettings: () => void;
}) {
  return (
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
        disabled={disabled}
        onPress={onSettings}
      />
    </View>
  );
}
