import { useTheme } from "../../theme/ThemeProvider";
import { Text, View } from "react-native";
import { Button, Card, Icon } from "../ui";

export function ConnectionPrompt({
  disabled,
  onConnect,
}: {
  disabled: boolean;
  onConnect: () => void;
}) {
  const { s } = useTheme();
  return (
    <Card>
      <View style={s.row}>
        <Icon name="lock" />
        <Text style={s.title}>Your private dashboard</Text>
      </View>
      <Text style={s.body}>
        Connect with your dashboard credentials to see all active files.
        Shared-file uploads are ready to use.
      </Text>
      <Button
        label="Connect dashboard"
        icon="arrow-right"
        disabled={disabled}
        onPress={onConnect}
      />
    </Card>
  );
}
