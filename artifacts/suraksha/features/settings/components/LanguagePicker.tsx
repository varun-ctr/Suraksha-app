import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/shared/components/Icon";
import { LANGUAGES, type LangCode, type LangMeta } from "@/features/settings/constants/languages";
import { useTheme } from "@/shared/theme/ThemeContext";

interface Props {
  selected: string;
  onSelect: (code: LangCode) => void;
}

function LangRow({
  item,
  selected,
  onSelect,
  c,
}: {
  item: LangMeta;
  selected: boolean;
  onSelect: (code: LangCode) => void;
  c: ReturnType<typeof useTheme>["c"];
}) {
  return (
    <Pressable
      onPress={() => onSelect(item.code as LangCode)}
      style={[
        styles.row,
        {
          backgroundColor: selected ? `${c.primary}14` : "transparent",
          borderColor: selected ? c.primary : c.border,
        },
      ]}
    >
      <Text style={styles.flag}>{item.flag}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={[
            styles.nativeName,
            { color: selected ? c.primary : c.text },
          ]}
          numberOfLines={1}
        >
          {item.nativeName}
        </Text>
        <Text style={[styles.engName, { color: c.textMuted }]} numberOfLines={1}>
          {item.englishName}
        </Text>
      </View>
      {selected && <Icon name="check" size={16} color={c.primary} />}
    </Pressable>
  );
}

export function LanguagePicker({ selected, onSelect }: Props) {
  const { c } = useTheme();
  const [query, setQuery] = useState("");
  const inputRef = useRef<TextInput>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q),
    );
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: LangMeta }) => (
      <LangRow
        item={item}
        selected={item.code === selected}
        onSelect={onSelect}
        c={c}
      />
    ),
    [selected, onSelect, c],
  );

  const keyExtractor = useCallback((item: LangMeta) => item.code, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Search bar */}
      <View style={[styles.searchRow, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
        <Icon name="search" size={16} color={c.textFaint} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search language…"
          placeholderTextColor={c.textFaint}
          style={[styles.searchInput, { color: c.text }]}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Icon name="x" size={14} color={c.textFaint} />
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 32 }}>
            <Text style={{ color: c.textMuted, fontSize: 13 }}>No language found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    padding: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  flag: { fontSize: 22, lineHeight: 28 },
  nativeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  engName: { fontSize: 11.5, fontFamily: "Inter_400Regular", marginTop: 1 },
});
