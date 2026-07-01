import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
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
import { firebaseAuth } from "@/lib/firebase";
import { getBackendUrl } from "@/lib/env";

type Msg = { id: string; role: "user" | "assistant"; content: string };
type SendResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "limit_reached" | "auth_required" | "network" | "server" };

async function sendSakhiMessage(
  messages: { role: "user" | "assistant"; content: string }[],
  language: string,
): Promise<SendResult> {
  const backendUrl = getBackendUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  try {
    const token = await firebaseAuth.currentUser?.getIdToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  } catch { /* no token — proceed unauthenticated */ }

  try {
    const res = await fetch(`${backendUrl}/sakhi/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, language }),
    });
    if (res.status === 401) return { ok: false, reason: "auth_required" };
    if (res.status === 402) return { ok: false, reason: "limit_reached" };
    if (!res.ok)            return { ok: false, reason: "server" };
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
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<Msg[]>([
    { id: "seed", role: "assistant", content: t("sakhi.greeting") },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending]           = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [netError, setNetError]         = useState(false);
  const [retryDone, setRetryDone]       = useState(false);

  const retryHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const retryTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = [t("sakhi.suggest1"), t("sakhi.suggest2"), t("sakhi.suggest3")];

  const handleResult = useCallback(
    (result: SendResult, isRetry: boolean) => {
      setPending(false);
      if (result.ok) {
        setNetError(false);
        setRetryDone(false);
        setMessages((prev) => [
          ...prev,
          { id: `a${Date.now()}`, role: "assistant", content: result.reply },
        ]);
      } else if (result.reason === "limit_reached") {
        setLimitReached(true);
      } else if (!isRetry) {
        setNetError(true);
        setRetryDone(false);
        retryTimerRef.current = setTimeout(async () => {
          setPending(true);
          const r2 = await sendSakhiMessage(retryHistoryRef.current, lang);
          handleResult(r2, true);
        }, 4000);
      } else {
        setNetError(true);
        setRetryDone(true);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    },
    [lang],
  );

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || limitReached) return;
      setInput("");
      setNetError(false);
      setRetryDone(false);
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }

      const userMsg: Msg = { id: `u${Date.now()}`, role: "user", content: trimmed };
      const next = [...messages, userMsg];
      setMessages(next);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      const history = next
        .filter((m) => m.id !== "seed")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      retryHistoryRef.current = history;

      setPending(true);
      const result = await sendSakhiMessage(history, lang);
      handleResult(result, false);
    },
    [messages, pending, lang, limitReached, handleResult],
  );

  const retryNow = useCallback(async () => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setNetError(false);
    setPending(true);
    const result = await sendSakhiMessage(retryHistoryRef.current, lang);
    handleResult(result, true);
  }, [lang, handleResult]);

  const errorMsg = lang === "hi"
    ? "अभी कनेक्शन नहीं हो पा रहा। कुछ देर में दोबारा कोशिश करें।"
    : "I'm having trouble connecting right now. Please try again in a moment.";

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
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: netError ? "#FCA5A5" : "#6EE7A8" }} />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5 }}>
                {netError ? (lang === "hi" ? "पुनः कनेक्ट हो रही है…" : "Reconnecting…") : t("sakhi.online")}
              </Text>
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
              <Text style={{ color: c.textMuted, fontSize: 12.5 }}>
                {netError && !retryDone
                  ? (lang === "hi" ? "पुनः प्रयास हो रहा है…" : "Retrying…")
                  : t("sakhi.thinking")}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {netError && !pending && (
        <View style={[styles.errorBanner, { backgroundColor: c.card, borderColor: c.danger ?? "#EF4444" }]}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <Icon name="wifiOff" size={18} color={c.danger ?? "#EF4444"} />
            <Text style={{ color: c.text, fontSize: 13, flex: 1, lineHeight: 19 }}>{errorMsg}</Text>
          </View>
          <Pressable
            onPress={retryNow}
            style={[styles.retryBtn, { backgroundColor: c.primary }]}
          >
            <Icon name="send" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" }}>
              {lang === "hi" ? "फिर कोशिश करें" : "Retry"}
            </Text>
          </Pressable>
          {retryDone && (
            <>
              <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 10, marginBottom: 8 }}>
                {lang === "hi" ? "इस दौरान:" : "While I reconnect:"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  { icon: "alert" as const, label: lang === "hi" ? "SOS" : "Activate SOS", onPress: () => router.push("/(tabs)") },
                  { icon: "map" as const,   label: lang === "hi" ? "मैप" : "Safety Map",    onPress: () => router.push("/(tabs)/map" as never) },
                  { icon: "navigation" as const, label: lang === "hi" ? "यात्रा" : "Journey", onPress: () => router.push("/(tabs)") },
                  { icon: "flag" as const,  label: lang === "hi" ? "रिपोर्ट" : "Report",   onPress: () => router.push("/(tabs)/incident" as never) },
                ].map((fb) => (
                  <Pressable
                    key={fb.label}
                    onPress={fb.onPress}
                    style={[styles.fallbackBtn, { backgroundColor: c.cardAlt, borderColor: c.border }]}
                  >
                    <Icon name={fb.icon} size={14} color={c.primary} />
                    <Text style={{ color: c.primary, fontSize: 12, fontFamily: "Inter_600SemiBold" }}>{fb.label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>
      )}

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
            onPress={() => { /* router.push('/premium') */ }}
            style={[styles.upgradeBtn, { backgroundColor: c.primary }]}
          >
            <Text style={{ color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" }}>
              {lang === "hi" ? "अपग्रेड" : "Upgrade"}
            </Text>
          </Pressable>
        </View>
      )}

      {messages.length <= 1 && !limitReached && !netError && (
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
  errorBanner: {
    margin: 12, padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10, alignSelf: "flex-start",
  },
  fallbackBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
  },
});
