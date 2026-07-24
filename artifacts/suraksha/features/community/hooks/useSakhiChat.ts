import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView } from "react-native";

import { findOfflineAnswer } from "@/features/community/utils/emergencyKnowledge";
import { useI18n } from "@/features/settings/context/LanguageContext";
import { apiFetch } from "@/core/network/apiClient";
import {
  cacheReply,
  clearSakhiHistory,
  getCachedReply,
  loadSakhiHistory,
  saveSakhiHistory,
} from "@/features/community/services/sakhiHistoryStore";

export type SakhiMsg = { id: string; role: "user" | "assistant"; content: string };
type SendResult =
  | { ok: true; reply: string }
  | { ok: false; reason: "limit_reached" | "auth_required" | "network" | "server" };

/** Bounded auto-retry backoff (ms) before falling back to a manual retry. */
const RETRY_DELAYS_MS = [2000, 4000, 8000];

async function sendSakhiMessage(
  messages: { role: "user" | "assistant"; content: string }[],
  language: string,
): Promise<SendResult> {
  // Longer than the default timeout — LLM replies are slower than a typical
  // API call, but this was previously *unbounded* (no timeout at all), the
  // one backend call in the app that could hang forever.
  const { response } = await apiFetch("/sakhi/chat", {
    method: "POST",
    body: JSON.stringify({ messages, language }),
    timeoutMs: 45_000,
  });

  if (!response) return { ok: false, reason: "network" };
  if (response.status === 401) return { ok: false, reason: "auth_required" };
  if (response.status === 402) return { ok: false, reason: "limit_reached" };
  if (!response.ok) return { ok: false, reason: "server" };
  try {
    const data = (await response.json()) as { reply: string };
    return { ok: true, reply: data.reply };
  } catch {
    return { ok: false, reason: "server" };
  }
}

/** All state and handlers for the Sakhi AI chat screen: send/retry, offline fallback, and local persistence. */
export function useSakhiChat() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<SakhiMsg[]>([
    { id: "seed", role: "assistant", content: t("sakhi.greeting") },
  ]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [netError, setNetError] = useState(false);
  const [retryDone, setRetryDone] = useState(false);

  const retryHistoryRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped by any action that supersedes in-flight async work (a new submit,
  // or clearing the chat) — every async continuation checks the generation
  // it started with against this before touching state, so a slow history
  // load or a stale retry/offline-fallback can't clobber newer messages.
  const generationRef = useRef(0);

  // Restore any locally-persisted conversation on mount.
  useEffect(() => {
    const gen = generationRef.current;
    loadSakhiHistory().then((stored) => {
      if (stored && generationRef.current === gen) setMessages(stored);
      setHistoryLoaded(true);
    });
  }, []);

  // Persist after every exchange (skip until the initial load resolves, so
  // we don't overwrite stored history with the seed greeting first).
  useEffect(() => {
    if (!historyLoaded) return;
    void saveSakhiHistory(messages);
  }, [messages, historyLoaded]);

  // Cancel any pending auto-retry backoff on unmount — without this, leaving
  // the chat screen mid-retry still let the timeout fire later, run a
  // network request, and call setState on an unmounted hook instance.
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    };
  }, []);

  const clearChat = useCallback(() => {
    generationRef.current++; // invalidate any in-flight request/retry/offline-fallback
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setMessages([{ id: "seed", role: "assistant", content: t("sakhi.greeting") }]);
    setPending(false);
    setNetError(false);
    setRetryDone(false);
    setLimitReached(false);
    void clearSakhiHistory();
  }, [t]);

  const showOfflineFallback = useCallback((lastUserMessage: string, gen: number) => {
    const offline = findOfflineAnswer(lastUserMessage, lang);
    void getCachedReply(lastUserMessage).then((cachedReply) => {
      if (generationRef.current !== gen) return;
      if (cachedReply) {
        setMessages((prev) => [
          ...prev,
          { id: `o${Date.now()}`, role: "assistant", content: `${cachedReply}\n\n_(${t("sakhi.cachedAnswer")})_` },
        ]);
      } else if (offline) {
        setMessages((prev) => [
          ...prev,
          {
            id: `o${Date.now()}`,
            role: "assistant",
            content: `**${offline.title}**\n\n${offline.body}\n\n_(${t("sakhi.offlineAnswer")})_`,
          },
        ]);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });
  }, [lang, t]);

  const handleResult = useCallback(
    (result: SendResult, attempt: number, gen: number) => {
      if (generationRef.current !== gen) return; // chat was cleared/replaced since this request started
      setPending(false);
      if (result.ok) {
        setNetError(false);
        setRetryDone(false);
        setMessages((prev) => [
          ...prev,
          { id: `a${Date.now()}`, role: "assistant", content: result.reply },
        ]);
        const lastUser = [...retryHistoryRef.current].reverse().find((m) => m.role === "user");
        if (lastUser) void cacheReply(lastUser.content, result.reply);
      } else if (result.reason === "limit_reached") {
        setLimitReached(true);
      } else if (attempt < RETRY_DELAYS_MS.length) {
        setNetError(true);
        setRetryDone(false);
        retryTimerRef.current = setTimeout(async () => {
          if (generationRef.current !== gen) return;
          setPending(true);
          const r2 = await sendSakhiMessage(retryHistoryRef.current, lang);
          handleResult(r2, attempt + 1, gen);
        }, RETRY_DELAYS_MS[attempt]);
      } else {
        setNetError(true);
        setRetryDone(true);
        const lastUser = [...retryHistoryRef.current].reverse().find((m) => m.role === "user");
        if (lastUser) showOfflineFallback(lastUser.content, gen);
      }
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    },
    [lang, showOfflineFallback],
  );

  const submit = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || limitReached) return;
      setInput("");
      setNetError(false);
      setRetryDone(false);
      if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      const gen = ++generationRef.current;

      const userMsg: SakhiMsg = { id: `u${Date.now()}`, role: "user", content: trimmed };
      const next = [...messages, userMsg];
      setMessages(next);
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

      const history = next
        .filter((m) => m.id !== "seed")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      retryHistoryRef.current = history;

      setPending(true);
      const result = await sendSakhiMessage(history, lang);
      handleResult(result, 0, gen);
    },
    [messages, pending, lang, limitReached, handleResult],
  );

  const retryNow = useCallback(async () => {
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    setNetError(false);
    setPending(true);
    const gen = generationRef.current;
    const result = await sendSakhiMessage(retryHistoryRef.current, lang);
    handleResult(result, RETRY_DELAYS_MS.length, gen);
  }, [lang, handleResult]);

  return {
    scrollRef, router,
    messages, input, setInput, pending, limitReached, netError, retryDone,
    clearChat, submit, retryNow,
  };
}
