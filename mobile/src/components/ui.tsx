import Feather from "@expo/vector-icons/Feather";
import { Pressable, Text, View } from "react-native";
import type { ComponentProps, ReactNode } from "react";
import { useTheme } from "../theme/ThemeProvider";

export function Icon({
  name,
  color,
  size = 19,
}: {
  name: ComponentProps<typeof Feather>["name"];
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return <Feather name={name} size={size} color={color ?? colors.accent} />;
}
export function Button({
  label,
  icon,
  onPress,
  primary,
  disabled,
  small,
}: {
  label: string;
  icon?: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const { colors, s } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        primary && s.primary,
        small && s.small,
        (pressed || disabled) && { opacity: 0.55 },
      ]}
    >
      {icon && (
        <Icon
          name={icon}
          size={small ? 16 : 18}
          color={primary ? colors.onPrimary : colors.accent}
        />
      )}
      <Text style={[s.buttonText, primary && { color: colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  disabled?: boolean;
}) {
  const { s } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.iconButton,
        (pressed || disabled) && { opacity: 0.5 },
      ]}
    >
      <Icon name={icon} />
    </Pressable>
  );
}
export function Card({ children }: { children: ReactNode }) {
  const { s } = useTheme();
  return <View style={s.card}>{children}</View>;
}
