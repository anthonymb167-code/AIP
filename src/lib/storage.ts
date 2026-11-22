import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_LEARNED_PREFERENCES,
  type ChatMessage,
  type CompanionIdentity,
  type LearnedPreferences,
} from "../types/kith";

export const AIP_SCHEMA_VERSION = 1;
export const MAX_CHAT_HISTORY = 50;

export const AIP_STORAGE_KEYS = {
  version: "aip_version",
  theme: "aip_theme",
  onboardingDone: "aip_onboardingDone",
  chatHistory: "aip_chatHistory",
  learnedPreferences: "aip_learnedPreferences",
  companion: "kith_studio_companion_v1",
  guardian: "kith_studio_guardian_v1",
  journals: "kith_studio_journals_v1",
  stories: "kith_studio_stories_v1",
  activity: "kith_studio_activity_v1",
} as const;

type StorageErrorListener = (message: string) => void;
const storageListeners = new Set<StorageErrorListener>();

export function subscribeStorageWarnings(listener: StorageErrorListener): () => void {
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

function notifyStorageWarning(err: unknown) {
  const msg =
    err instanceof Error && err.name === "QuotaExceededError"
      ? "Browser storage is full. Changes will stay active for this session, or clear old journal entries."
      : "Local browser storage is unavailable. Changes stay active in memory for this session.";
  storageListeners.forEach((fn) => fn(msg));
}

export function safeReadStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw === "undefined" || raw === "null") {
      return fallback;
    }
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || parsed === undefined) {
      return fallback;
    }
    return parsed;
  } catch {
    return fallback;
  }
}

export function safeWriteStorage<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    notifyStorageWarning(err);
    return false;
  }
}

export function ensureStorageVersion(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(AIP_STORAGE_KEYS.version);
    const current = raw ? Number(raw) : 0;
    if (!Number.isFinite(current) || current < AIP_SCHEMA_VERSION) {
      window.localStorage.setItem(
        AIP_STORAGE_KEYS.version,
        String(AIP_SCHEMA_VERSION)
      );
    }
  } catch (err) {
    notifyStorageWarning(err);
  }
}

export function isOnboardingDone(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(AIP_STORAGE_KEYS.onboardingDone) === "true";
  } catch {
    return true;
  }
}

export function setOnboardingDone(done: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (done) {
      window.localStorage.setItem(AIP_STORAGE_KEYS.onboardingDone, "true");
    } else {
      window.localStorage.removeItem(AIP_STORAGE_KEYS.onboardingDone);
    }
  } catch (err) {
    notifyStorageWarning(err);
  }
}

export function createWelcomeChatMessage(identity: CompanionIdentity): ChatMessage {
  const callName = identity.activeNickname || "friend";
  return {
    id: "welcome-1",
    role: "kith",
    text: `Right here with you, ${callName}. Whether you need help untangling a tough problem, exploring a great book, or just someone steady on your side—${identity.primaryName} has your back.`,
    gesture: "warm_nod",
    voiceTone: identity.voiceTone,
    createdAtIso: new Date().toISOString(),
  };
}

export function loadChatHistory(identity: CompanionIdentity): ChatMessage[] {
  const saved = safeReadStorage<unknown>(AIP_STORAGE_KEYS.chatHistory, null);
  if (Array.isArray(saved) && saved.length > 0) {
    const valid = saved
      .filter(
        (m): m is ChatMessage =>
          Boolean(m) &&
          typeof m === "object" &&
          typeof (m as ChatMessage).id === "string" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "kith") &&
          typeof (m as ChatMessage).text === "string"
      )
      .slice(-MAX_CHAT_HISTORY);
    if (valid.length > 0) {
      return valid;
    }
  }
  return [createWelcomeChatMessage(identity)];
}

export function saveChatHistory(messages: ChatMessage[]): void {
  const capped = messages.slice(-MAX_CHAT_HISTORY);
  safeWriteStorage(AIP_STORAGE_KEYS.chatHistory, capped);
}

export function loadLearnedPreferences(): LearnedPreferences {
  const saved = safeReadStorage<Partial<LearnedPreferences> | null>(
    AIP_STORAGE_KEYS.learnedPreferences,
    null
  );
  if (!saved || typeof saved !== "object") {
    return DEFAULT_LEARNED_PREFERENCES;
  }
  return {
    likedNotes: Array.isArray(saved.likedNotes)
      ? saved.likedNotes.map(String).filter(Boolean).slice(0, 12)
      : [],
    dislikedNotes: Array.isArray(saved.dislikedNotes)
      ? saved.dislikedNotes.map(String).filter(Boolean).slice(0, 12)
      : [],
    upCount: Number.isFinite(Number(saved.upCount)) ? Math.max(0, Number(saved.upCount)) : 0,
    downCount: Number.isFinite(Number(saved.downCount)) ? Math.max(0, Number(saved.downCount)) : 0,
    lastUpdatedIso: typeof saved.lastUpdatedIso === "string" ? saved.lastUpdatedIso : undefined,
  };
}

export function saveLearnedPreferences(prefs: LearnedPreferences): void {
  safeWriteStorage(AIP_STORAGE_KEYS.learnedPreferences, prefs);
}

export function clearAllAipStorage(preserveTheme = true): void {
  if (typeof window === "undefined") return;
  try {
    const savedTheme = preserveTheme
      ? window.localStorage.getItem(AIP_STORAGE_KEYS.theme)
      : null;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("aip_") || k.startsWith("kith_studio_"))) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    window.localStorage.setItem(
      AIP_STORAGE_KEYS.version,
      String(AIP_SCHEMA_VERSION)
    );
    if (preserveTheme && savedTheme) {
      window.localStorage.setItem(AIP_STORAGE_KEYS.theme, savedTheme);
    }
  } catch (err) {
    notifyStorageWarning(err);
  }
}

export function useLocalStorage<T>(
  key: string,
  defaultValue: T,
  debounceMs = 300
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(() => safeReadStorage<T>(key, defaultValue));
  const timerRef = useRef<number | null>(null);
  const latestRef = useRef<T>(state);
  latestRef.current = state;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setState((prev) => {
        const resolved =
          typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        latestRef.current = resolved;
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          safeWriteStorage(key, latestRef.current);
          timerRef.current = null;
        }, debounceMs);
        return resolved;
      });
    },
    [key, debounceMs]
  );

  const reset = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setState(defaultValue);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
  }, [key, defaultValue]);

  return [state, setValue, reset];
}
