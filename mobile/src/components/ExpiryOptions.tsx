import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DEFAULT_EXPIRY_SECONDS, EXPIRY_OPTIONS } from "../lib/expiry";
import { useTheme } from "../theme/ThemeProvider";
import { Button } from "./ui";
import { formatDuration } from "../lib/format";

export function ExpiryOptions({
  value,
  onChange,
  disabled,
  preference = false,
}: {
  value: number;
  onChange: (seconds: number) => void;
  disabled: boolean;
  preference?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const { colors, s } = useTheme();
  const selected = EXPIRY_OPTIONS.find((option) => option.seconds === value);
  return (
    <View style={{ gap: 12 }}>
      <Button
        label={
          expanded
            ? "Hide expiry options"
            : preference
              ? `Default upload expiry: ${selected?.label ?? formatDuration(value * 1000)}`
              : value === DEFAULT_EXPIRY_SECONDS
                ? "Set link expiry (optional)"
                : `Link expiry: ${selected?.label ?? formatDuration(value * 1000)}`
        }
        icon="clock"
        small
        disabled={disabled}
        onPress={() => setExpanded((old) => !old)}
      />
      {expanded && (
        <>
          <Text style={s.label}>
            {preference
              ? "Default lifetime for uploads"
              : "Keep these files available for"}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {EXPIRY_OPTIONS.map((option) => (
              <Pressable
                key={option.seconds}
                accessibilityRole="button"
                accessibilityLabel={`Expire after ${option.label}`}
                accessibilityState={{
                  selected: value === option.seconds,
                  disabled,
                }}
                disabled={disabled}
                onPress={() => onChange(option.seconds)}
                style={({ pressed }) => [
                  s.button,
                  s.small,
                  value === option.seconds && {
                    backgroundColor: colors.soft,
                    borderColor: colors.selectedBorder,
                  },
                  (pressed || disabled) && { opacity: 0.55 },
                ]}
              >
                <Text style={s.buttonText}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.body}>
            {preference
              ? "Used automatically for new uploads unless you choose another expiry. "
              : "Starts when each upload finishes. "}
            One month means 30 days.
          </Text>
        </>
      )}
    </View>
  );
}
