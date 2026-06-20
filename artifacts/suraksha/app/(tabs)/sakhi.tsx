import { useSendSakhiMessage } from "@workspace/api-client-react";
import type { SakhiChatMessage } from "@workspace/api-client-react";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/context/LanguageContext";
import { useTheme } from "@/context/ThemeContext";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function SakhiScreen() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const send = useSendSakhiMessage();

  const [messages, setMessages] = useState<Msg[]>([
    { id: "seed", role: "assistant", content: t("sakhi.greeting") },
  ]);
  const [input, setInput] = useState("");

  const suggestions = [t("sakhi.suggest1"), t("sakhi.suggest2"), t("sakhi.suggest3")];

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    setInput("");

    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    const history: SakhiChatMessage[] = next
      .filter((m) => m.id !== "seed")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await send.mutateAsync({ data: { messages: history, language: lang } });
      setMessages((prev) => [
        ...prev,
        { id: `a${Date.now()}`, role: "assistant", content: res.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e${Date.now()}`, role: "assistant", content: t("sakhi.error") },
      ]);
    } finally {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <LinearGradient
        colors={[c.primary, c.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 16 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={styles.botAvatar}>
            <Icon name="sparkles" size={20} color="#fff" />
          </View>
          <View>
            <Text style={{ color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" }}>{t("sakhi.title")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#6EE7A8" }} />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5 }}>{t("sakhi.online")}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((m) => {
          const mine = m.role === "user";
          return (
            <View
              key={m.id}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "82%",
                marginBottom: 10,
              }}
            >
              <View
                style={{
                  backgroundColor: mine ? c.primary : c.card,
                  borderColor: mine ? "transparent" : c.border,
                  borderWidth: mine ? 0 : 1,
                  borderRadius: 16,
                  borderBottomRightRadius: mine ? 4 : 16,
                  borderBottomLeftRadius: mine ? 16 : 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: mine ? "#fff" : c.text, fontSize: 13.5, lineHeight: 20 }}>{m.content}</Text>
              </View>
            </View>
          );
        })}
        {send.isPending && (
          <View style={{ alignSelf: "flex-start", marginBottom: 10 }}>
            <View style={[styles.typing, { backgroundColor: c.card, borderColor: c.border }]}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={{ color: c.textMuted, fontSize: 12.5 }}>{t("sakhi.thinking")}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {messages.length <= 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}
        >
          {suggestions.map((s) => (
            <Pressable
              key={s}
              onPress={() => submit(s)}
              style={[styles.suggestion, { backgroundColor: c.cardAlt, borderColor: c.border }]}
            >
              <Text style={{ color: c.primary, fontSize: 12.5, fontFamily: "Inter_600SemiBold" }}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <View
        style={[
          styles.inputBar,
          { backgroundColor: c.card, borderTopColor: c.border, paddingBottom: insets.bottom + 10 },
        ]}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t("sakhi.placeholder")}
          placeholderTextColor={c.textFaint}
          style={[styles.input, { backgroundColor: c.cardAlt, color: c.text }]}
          multiline
          onSubmitEditing={() => submit(input)}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => submit(input)}
          disabled={!input.trim() || send.isPending}
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() && !send.isPending ? c.primary : c.border },
          ]}
        >
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  botAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  suggestion: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 13.5,
    maxHeight: 110,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
