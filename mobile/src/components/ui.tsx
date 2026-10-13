import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ComponentProps, ReactNode } from "react";

export const colors = {
  accent: "#6355D9",
  ink: "#24252A",
  muted: "#747982",
  line: "#E7E9EE",
  bg: "#F7F8FA",
  soft: "#F1EFFF",
  green: "#38846A",
  red: "#B04444",
};
export function Icon({
  name,
  color = colors.accent,
  size = 19,
}: {
  name: ComponentProps<typeof Feather>["name"];
  color?: string;
  size?: number;
}) {
  return <Feather name={name} size={size} color={color} />;
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
          color={primary ? "#FFF" : colors.accent}
        />
      )}
      <Text style={[s.buttonText, primary && { color: "#FFF" }]}>{label}</Text>
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
  return <View style={s.card}>{children}</View>;
}
export const s = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  body: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.bg,
    padding: 14,
    color: colors.ink,
    fontSize: 15,
    minHeight: 48,
  },
  button: {
    minHeight: 45,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF",
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent },
  small: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8 },
  buttonText: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: "#FFF",
  },
  error: {
    color: colors.red,
    fontSize: 13,
    lineHeight: 20,
    padding: 14,
    backgroundColor: "#FFF0F0",
    borderRadius: 12,
  },
  progress: {
    height: 5,
    backgroundColor: colors.soft,
    borderRadius: 5,
    overflow: "hidden",
  },
});
