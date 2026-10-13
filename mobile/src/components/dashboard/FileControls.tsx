import { useTheme } from "../../theme/ThemeProvider";
import { Pressable, Text, TextInput, View } from "react-native";
import type { SortOrder } from "../../lib/types";
import { Icon, IconButton } from "../ui";

const sorts: [SortOrder, string][] = [
  ["newest", "Newest"],
  ["expiry", "Expiring"],
  ["size", "Largest"],
  ["name", "A–Z"],
];

export function FileControls({
  count,
  refreshing,
  query,
  sort,
  onRefresh,
  onQueryChange,
  onSortChange,
}: {
  count: number;
  refreshing: boolean;
  query: string;
  sort: SortOrder;
  onRefresh: () => Promise<void>;
  onQueryChange: (query: string) => void;
  onSortChange: (sort: SortOrder) => void;
}) {
  const { colors, s, styles, isDark } = useTheme();
  return (
    <>
      <View style={s.between}>
        <Text style={s.title}>
          Active files <Text style={{ color: colors.muted }}>· {count}</Text>
        </Text>
        <IconButton
          label="Refresh files"
          icon="refresh-cw"
          disabled={refreshing}
          onPress={() => {
            void onRefresh();
          }}
        />
      </View>
      <View style={styles.search}>
        <Icon name="search" color={colors.muted} size={18} />
        <TextInput
          accessibilityLabel="Search active files"
          placeholder="Search files…"
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          keyboardAppearance={isDark ? "dark" : "light"}
          value={query}
          onChangeText={onQueryChange}
          style={{
            flex: 1,
            minWidth: 0,
            color: colors.ink,
            fontSize: 14,
            paddingVertical: 10,
          }}
          autoCorrect={false}
          autoCapitalize="none"
          underlineColorAndroid="transparent"
        />
        {!!query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            onPress={() => onQueryChange("")}
            style={({ pressed }) => [
              styles.clearSearch,
              pressed && { opacity: 0.55 },
            ]}
          >
            <Icon name="x" size={19} />
          </Pressable>
        )}
      </View>
      <View style={styles.sorts}>
        {sorts.map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityLabel={`Sort ${label}`}
            accessibilityState={{ selected: sort === value }}
            onPress={() => onSortChange(value)}
            style={[styles.sort, value === sort && styles.selectedSort]}
          >
            <Text
              style={{
                color: sort === value ? colors.accent : colors.muted,
                fontWeight: "600",
                fontSize: 12,
              }}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </>
  );
}
