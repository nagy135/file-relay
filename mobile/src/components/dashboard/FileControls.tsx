import { Pressable, Text, TextInput, View } from "react-native";
import type { SortOrder } from "../../lib/types";
import { colors, Icon, IconButton, s } from "../ui";
import { styles } from "./styles";

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
          value={query}
          onChangeText={onQueryChange}
          style={{
            flex: 1,
            color: colors.ink,
            fontSize: 14,
            paddingVertical: 12,
          }}
          autoCorrect={false}
        />
        <IconButton
          label="Clear search"
          icon="x"
          onPress={() => onQueryChange("")}
        />
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
