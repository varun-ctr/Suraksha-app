import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useRef, useState } from "react";
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
import { supabase } from "@/lib/supabaseClient";
import { getBackendUrl } from "@/lib/env";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type SendResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "limit_reached" | "auth_required" | "network" | "server" };

async function sendSakhiMessage(
  messages: { role: "user" | "assistant"; content: string }[],
  language: string,
): Promise<SendResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const backendUrl = getBackendUrl();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${backendUrl}/sakhi/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, language }),
    });

    if (res.status === 401) return { ok: false, reason: "auth_required" };
    if (res.status === 402) return { ok: false, reason: "limit_reached" };

    if (!res.ok) return { ok: false, reason: "server" };

    const data = (await res.json()) as { reply: string };
    return { ok: true, reply: data.reply };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export default function SakhiScreen() {
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Msg[]>([
    { id: "seed", role: "assistant", content: t("sakhi.greeting") },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const suggestions = [t("sakhi.suggest1"), t("sakhi.suggest2"), t("sakhi.suggest3")];

  const submit = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setInput("");
    setLimitReached(false);

    const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

    setPending(true);
    const history = next
      .filter((m) => m.id !== "seed")
      .map((m) => ({ role: m.role, content: m.content }));

    const result = await sendSakhiMessage(history, lang);
    setPending(false);

    if (result.ok) {
      setMessages((prev) => [
        ...prev,
        { id: `a${Date.now()}`, role: "assistant", content: result.reply },
      ]);
    } else if (result.reason === "limit_reached") {
      setLimitReached(true);
    } else if (result.reason === "auth_required") {
      setMessages((prev) => [
        ...prev,
        {
          id: `e${Date.now()}`,
          role: "assistant",
          content: lang === "hi"
            ? "कुछ गड़बड़ हो गई। कृपया दोबारा कोशिश करें।"
            : "Something went wrong. Please try again in a moment.",
        },
      ]);
    } else {
      setMessages((prev) => [
        ...prev,
        { id: `e${Date.now()}`, role: "assistant", content: t("sakhi.error") },
      ]);
    }

    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [messages, pending, lang, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%", marginBottom: 10 }}
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

        {pending && (
          <View style={{ alignSelf: "flex-start", marginBottom: 10 }}>
            <View style={[styles.typing, { backgroundColor: c.card, borderColor: c.border }]}>
              <ActivityIndicator size="small" color={c.primary} />
              <Text style={{ color: c.textMuted, fontSize: 12.5 }}>{t("sakhi.thinking")}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {limitReached && (
        <View style={[styles.paywallBanner, { backgroundColor: c.card, borderColor: c.primary }]}>
          <Icon name="crown" size={18} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
              {lang === "hi" ? "5 मुफ़्त संदेश उपयोग हो गए" : "Free messages used up"}
            </Text>
            <Text style={{ color: c.textMuted, fontSize: 11.5, marginTop: 2 }}>
              {lang === "hi" ? "असीमित Sakhi चैट के लिए प्रीमियम लें।" : "Upgrade to Premium for unlimited Sakhi access."}
            </Text>
          </View>
          <Pressable
            onPress={() => { /* router.push('/premium') — wired in auth task */ }}
            style={[styles.upgradeBtn, { backgroundColor: c.primary }]}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
              {lang === "hi" ? "अपग्रेड" : "Upgrade"}
            </Text>
          </Pressable>
        </View>
      )}

      {messages.length <= 1 && !limitReached && (
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
          editable={!limitReached}
        />
        <Pressable
          onPress={() => submit(input)}
          disabled={!input.trim() || pending || limitReached}
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() && !pending && !limitReached ? c.primary : c.border },
          ]}
        >
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 4, alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: c.textFaint, textAlign: "center" }}>{t("sakhi.disclaimer")}</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  botAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  typing: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10,
  },
  suggestion: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 10,
    paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1,
  },
  input: {
    flex: 1, borderRadius: 22, paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 10, fontSize: 13.5, maxHeight: 110,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  paywallBanner: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 12, padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  upgradeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
});
