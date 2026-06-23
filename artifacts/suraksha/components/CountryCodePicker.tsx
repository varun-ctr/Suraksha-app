import React, { useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { COUNTRIES, type CountryOption } from "@/constants/countries";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

interface CountryCodePickerProps {
  value: CountryOption;
  onChange: (c: CountryOption) => void;
}

export function CountryCodePicker({ value, onChange }: CountryCodePickerProps) {
  const { c } = useTheme();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (co) =>
        co.name.toLowerCase().includes(q) ||
        co.dial.includes(q) ||
        co.code.toLowerCase().includes(q),
    );
  }, [query]);

  const handleOpen = () => {
    setQuery("");
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 120);
  };

  const handleSelect = (co: CountryOption) => {
    onChange(co);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={handleOpen}
        style={[styles.trigger, { backgroundColor: "rgba(255,255,255,0.6)", borderColor: "rgba(124,58,237,0.2)" }]}
        accessibilityLabel={`Country code: ${value.dial}`}
        accessibilityRole="button"
      >
        <Text style={styles.flag}>{value.flag}</Text>
        <Text style={styles.dial}>{value.dial}</Text>
        <Icon name="chevronDown" size={13} color="rgba(80,60,120,0.6)" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={[styles.backdrop]} onPress={() => setOpen(false)}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: c.card, paddingBottom: insets.bottom + 12 },
            ]}
            onPress={() => {}}
          >
            <View style={[styles.handle, { backgroundColor: c.border }]} />
            <Text style={[styles.sheetTitle, { color: c.text }]}>{t("login.countryCode")}</Text>

            <View style={[styles.searchWrap, { backgroundColor: c.cardAlt, borderColor: c.border }]}>
              <Icon name="search" size={15} color={c.textMuted} />
              <TextInput
                ref={searchRef}
                value={query}
                onChangeText={setQuery}
                placeholder={t("login.searchCountry")}
                placeholderTextColor={c.textFaint}
                style={[styles.searchInput, { color: c.text }]}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
              />
              {query.length > 0 && (
                <Pressable onPress={() => setQuery("")} hitSlop={8}>
                  <Icon name="x" size={14} color={c.textMuted} />
                </Pressable>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(item) => item.code}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = item.code === value.code;
                return (
                  <Pressable
                    onPress={() => handleSelect(item)}
                    style={[
                      styles.countryRow,
                      { borderBottomColor: c.border },
                      active && { backgroundColor: `${c.primary}14` },
                    ]}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={[styles.rowName, { color: c.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.rowDial, { color: c.textMuted }]}>{item.dial}</Text>
                    {active && <Icon name="check" size={15} color={c.primary} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: c.textMuted }]}>No results</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  flag: { fontSize: 18 },
  dial: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1A0A2E" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 16,
  },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowFlag: { fontSize: 20, width: 28, textAlign: "center" },
  rowName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  rowDial: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: { textAlign: "center", paddingVertical: 24, fontSize: 13 },
});
