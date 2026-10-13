import { useTheme } from "../../theme/ThemeProvider";
import { View } from "react-native";
import { Button } from "../ui";

export function LinkActions({
  url,
  onCopy,
  onShare,
}: {
  url: string;
  onCopy: (url: string) => Promise<void>;
  onShare: (url: string) => Promise<void>;
}) {
  const { s } = useTheme();
  return (
    <View style={s.row}>
      <Button
        label="Copy link"
        icon="copy"
        small
        onPress={() => {
          void onCopy(url);
        }}
      />
      <Button
        label="Share link"
        icon="share-2"
        small
        onPress={() => {
          void onShare(url);
        }}
      />
    </View>
  );
}
