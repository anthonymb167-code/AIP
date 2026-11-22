import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Send,
  Volume2,
  WifiOff,
  Wifi,
  Paperclip,
  Bell,
  Smile,
  Music,
  Play,
  Pause,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Brain,
} from "lucide-react";
import {
  ARCHETYPES,
  AVATAR_FRAMING_OPTIONS,
  DEFAULT_MUSIC_SPEC,
  GESTURE_LABELS,
  getOfflineCompanionReply,
  resolvePersonaVoiceSpec,
  type AgeTier,
  type AvatarFraming,
  type ChatMessage,
  type CompanionIdentity,
  type GestureId,
  type LearnedPreferences,
  type PersonaKey,
  type ProactiveTriggerId,
  type UserGuardianProfile,
  type VisemeId,
  type VoiceTone,
} from "../types/kith";
import { LiveRigSvg } from "./CompanionStageAvatar";
import { CompanionAvatar3D } from "./CompanionAvatar3D";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { getVoiceSampleKey } from "../lib/audioStore";
import { musicEngine } from "../lib/musicEngine";
import { speakCompanionLine } from "../lib/voice";

interface LiveCompanionViewProps {
  identity: CompanionIdentity;
  userId?: string | null;
  guardian: UserGuardianProfile;
  ageTier: AgeTier;
  offlineMode: boolean;
  onToggleOffline: () => void;
  onUpdateIdentity?: (next: CompanionIdentity) => void;
  onUpdateGuardian: (next: UserGuardianProfile) => void;
  onLogActivity: (summary: string) => void;
  messages: ChatMessage[];
  onUpdateMessages: (next: ChatMessage[]) => void;
  onClearChat: () => void;
  learnedPreferences: LearnedPreferences;
  onRateMessage: (msgId: string, rating: "up" | "down") => void;
  memoryContext?: string;
  hasUnreadProactive?: boolean;
  proactivePauseOffer?: boolean;
  onOpenMemoryViewer?: () => void;
  onMarkProactiveRead?: () => void;
  onDismissProactive?: (msgId: string, triggerId: ProactiveTriggerId) => void;
  onRespondPauseProactive?: (pause: boolean) => void;
  onSummarizeSession?: (
    msgs: ChatMessage[],
    personaKey: PersonaKey,
    personaLabel: string
  ) => Promise<boolean>;
  memoryUpdatedToast?: string | null;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const MOOD_PHRASE_PRESETS = [
  { trigger: "High-stakes moment", quote: "You know more than your nerves admit. Five slow breaths, then one step at a time." },
  { trigger: "Need a quick laugh", quote: "If life hands you plot holes today, let's edit the chapter together over tea." },
  { trigger: "Feeling stuck", quote: "Every locked door has a hinge. Tell me what's blocking you—we'll find the latch." },
];

export function LiveCompanionView({
  identity,
  userId,
  guardian,
  ageTier,
  offlineMode,
  onToggleOffline,
  onUpdateIdentity,
  onUpdateGuardian,
  onLogActivity,
  messages,
  onUpdateMessages,
  onClearChat,
  learnedPreferences,
  onRateMessage,
  memoryContext,
  hasUnreadProactive = false,
  proactivePauseOffer = false,
  onOpenMemoryViewer,
  onMarkProactiveRead,
  onDismissProactive,
  onRespondPauseProactive,
  onSummarizeSession,
  memoryUpdatedToast,
}: LiveCompanionViewProps) {
  const arch = ARCHETYPES[identity.archetype];
  const callName = identity.activeNickname || "friend";
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{
    data: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeGesture, setActiveGesture] = useState<GestureId>("warm_nod");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnergy, setSpeechEnergy] = useState(0);
  const [speechViseme, setSpeechViseme] = useState<VisemeId>("closed");
  const [stageMode, setStageMode] = useState<"3d" | "rig">("3d");
  const [musicPlaying, setMusicPlaying] = useState(() => musicEngine.isPlaying());
  const [lockPreviewText, setLockPreviewText] = useState(
    guardian.lockScreenMoodPhrase
  );
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const voiceDictationSupported = getSpeechRecognitionCtor() !== null;
  const lastSummarizedUserCountRef = useRef<number>(0);
  const latestStateRef = useRef({ messages, identity, onSummarizeSession });
  latestStateRef.current = { messages, identity, onSummarizeSession };

  useEffect(() => {
    setLockPreviewText(guardian.lockScreenMoodPhrase);
  }, [guardian.lockScreenMoodPhrase]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  useEffect(() => {
    return musicEngine.subscribe((playing) => {
      setMusicPlaying(playing);
    });
  }, []);

  // Auto-summarize after >= 3 user messages & 45s idle
  const userMessageCount = messages.filter((m) => m.role === "user").length;
  useEffect(() => {
    if (!onSummarizeSession) return;
    if (userMessageCount < 3 || userMessageCount <= lastSummarizedUserCountRef.current) {
      return;
    }
    const timer = window.setTimeout(() => {
      const persona = resolvePersonaVoiceSpec(
        identity.activeNickname,
        identity.primaryName
      );
      lastSummarizedUserCountRef.current = userMessageCount;
      void onSummarizeSession(messages, persona.key, persona.label);
    }, 45000);
    return () => window.clearTimeout(timer);
  }, [userMessageCount, messages, identity.activeNickname, identity.primaryName, onSummarizeSession]);

  // Summarize cleanly when leaving view or closing page if >= 3 unsummarized user turns exist
  useEffect(() => {
    const flushSummary = () => {
      const { messages: curMsgs, identity: curId, onSummarizeSession: summarize } =
        latestStateRef.current;
      if (!summarize) return;
      const curCount = curMsgs.filter((m) => m.role === "user").length;
      if (curCount >= 3 && curCount > lastSummarizedUserCountRef.current) {
        const persona = resolvePersonaVoiceSpec(curId.activeNickname, curId.primaryName);
        lastSummarizedUserCountRef.current = curCount;
        void summarize(curMsgs, persona.key, persona.label);
      }
    };
    window.addEventListener("pagehide", flushSummary);
    return () => {
      window.removeEventListener("pagehide", flushSummary);
      flushSummary();
    };
  }, []);

  function handleToggleDictation() {
    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore stop error
      }
      setListening(false);
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    try {
      const rec = new Ctor();
      rec.lang = "en-US";
      rec.interimResults = false;
      rec.continuous = false;
      rec.onresult = (event) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i]?.[0]?.transcript;
          if (item) parts.push(item.trim());
        }
        const transcript = parts.join(" ").trim();
        if (transcript) {
          setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
        }
      };
      rec.onerror = () => {
        setListening(false);
      };
      rec.onend = () => {
        setListening(false);
      };
      recognitionRef.current = rec;
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  }

  function handleAttachment(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setAttachment({
        data: base64,
        mimeType: file.type || "image/png",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;
    setError(null);
    onMarkProactiveRead?.();
    const activePersona = resolvePersonaVoiceSpec(
      identity.activeNickname,
      identity.primaryName
    );

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed || `Shared ${attachment?.fileName}`,
      createdAtIso: new Date().toISOString(),
    };
    const nextMessages = [...messages, userMsg];
    onUpdateMessages(nextMessages);
    setInput("");

    if (offlineMode || (typeof navigator !== "undefined" && !navigator.onLine)) {
      const offline = getOfflineCompanionReply(trimmed, identity);
      setActiveGesture(offline.gesture);
      onUpdateMessages([
        ...nextMessages,
        {
          id: `k-${Date.now()}`,
          role: "kith",
          text: offline.reply,
          gesture: offline.gesture,
          voiceTone: offline.voiceTone,
          personaLabel: activePersona.label,
          createdAtIso: new Date().toISOString(),
        },
      ]);
      setAttachment(null);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/kith/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextMessages.map((m) => ({ role: m.role, text: m.text })),
          identity,
          ageTier,
          userName: guardian.displayName,
          learnedPreferences,
          memoryContext: memoryContext || undefined,
          attachment: attachment
            ? { data: attachment.data, mimeType: attachment.mimeType }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to reach companion.");
      }

      const nextGesture = (data.gesture as GestureId) || "warm_nod";
      const nextTone = (data.voiceTone as VoiceTone) || identity.voiceTone;
      setActiveGesture(nextGesture);
      onUpdateMessages([
        ...nextMessages,
        {
          id: `k-${Date.now()}`,
          role: "kith",
          text: data.reply,
          gesture: nextGesture,
          voiceTone: nextTone,
          evolutionNote: data.evolutionNote,
          personaLabel: activePersona.label,
          createdAtIso: new Date().toISOString(),
        },
      ]);
      setAttachment(null);
      onLogActivity(`Live conversation with ${identity.primaryName}`);
      if (identity.voiceAutoSpeak && identity.voiceSource !== "silent" && data.reply) {
        void handleSpeak(data.reply, nextTone);
      }
    } catch {
      const fallback = getOfflineCompanionReply(trimmed || "help", identity);
      setActiveGesture(fallback.gesture);
      onUpdateMessages([
        ...nextMessages,
        {
          id: `k-${Date.now()}`,
          role: "kith",
          text: fallback.reply,
          gesture: fallback.gesture,
          voiceTone: fallback.voiceTone,
          personaLabel: activePersona.label,
          isFallback: true,
          createdAtIso: new Date().toISOString(),
        },
      ]);
      setAttachment(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleSpeak(text: string, tone: VoiceTone) {
    if (identity.voiceSource === "silent") return;
    const activePersona = resolvePersonaVoiceSpec(
      identity.activeNickname,
      identity.primaryName
    );
    const sampleKind =
      identity.voiceSource === "recorded_media" ||
      identity.voiceSource === "live_mic" ||
      identity.voiceSource === "own_voice"
        ? identity.voiceSource
        : null;
    await speakCompanionLine(
      text,
      tone,
      offlineMode,
      () => setIsSpeaking(true),
      () => {
        setIsSpeaking(false);
        setSpeechEnergy(0);
        setSpeechViseme("closed");
      },
      (frame) => {
        setSpeechEnergy(frame.energy);
        setSpeechViseme(frame.viseme);
      },
      identity.gender,
      {
        voiceSource: identity.voiceSource,
        voicePresetId: identity.voicePresetId,
        voiceStylePrompt: identity.voiceStylePrompt,
        voiceExternalUrl: identity.voiceExternalUrl,
        sampleKey: sampleKind ? getVoiceSampleKey(sampleKind, userId) : undefined,
        personaKey: activePersona.key,
      }
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Presence & Lock Screen Companion */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge">
            <div className="text-xs text-ink-muted">
              <span className="font-semibold text-ink">{identity.primaryName}</span>
              {identity.activeNickname && <span> · "{identity.activeNickname}"</span>}
              <span> · {arch.shortLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStageMode((m) => (m === "3d" ? "rig" : "3d"))}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong cursor-pointer"
              >
                {stageMode === "3d" ? "3D View" : "2D Rig"}
              </button>
              <button
                type="button"
                onClick={onToggleOffline}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                  offlineMode
                    ? "bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800"
                    : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                }`}
              >
                {offlineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                <span>{offlineMode ? "Offline Mode" : "Online"}</span>
              </button>
            </div>
          </div>

          <div className="p-5">
            {stageMode === "3d" ? (
              <CompanionAvatar3D
                identity={identity}
                gesture={activeGesture}
                framing={identity.cameraFraming || "half_body"}
                onChangeFraming={(cameraFraming: AvatarFraming) =>
                  onUpdateIdentity?.({ ...identity, cameraFraming })
                }
                isSpeaking={isSpeaking}
                speechEnergy={speechEnergy}
                speechViseme={speechViseme}
                heightClass="h-[300px]"
              />
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-2xl bg-[#090D16] border border-[#1E293B] p-4 flex items-center justify-center overflow-hidden">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-10 rounded-full opacity-15 blur-3xl dark:opacity-30 dark:blur-2xl"
                    style={{ backgroundColor: arch.accentHex }}
                  />
                  <div className="relative z-10 w-full max-w-[230px]">
                    <LiveRigSvg
                      identity={identity}
                      gesture={activeGesture}
                      framing={identity.cameraFraming || "half_body"}
                      isSpeaking={isSpeaking}
                      speechEnergy={speechEnergy}
                      speechViseme={speechViseme}
                    />
                  </div>
                </div>
                {onUpdateIdentity && (
                  <div className="flex items-center justify-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg w-fit mx-auto">
                    {AVATAR_FRAMING_OPTIONS.map((opt) => {
                      const active = (identity.cameraFraming || "half_body") === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() =>
                            onUpdateIdentity({ ...identity, cameraFraming: opt.id })
                          }
                          className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? "bg-surface text-ink ring-1 ring-edge"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 text-center text-xs text-ink-muted">
              <span className="font-medium text-accent-ink">
                {GESTURE_LABELS[activeGesture].label}
              </span>{" "}
              · {GESTURE_LABELS[activeGesture].cue}
            </div>
          </div>

          {onUpdateIdentity && (
            <div className="px-5 py-3 border-t border-edge bg-surface-alt flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Music
                  className={`w-3.5 h-3.5 shrink-0 ${
                    musicPlaying ? "text-accent-ink" : "text-ink-muted"
                  }`}
                />
                <span className="text-xs text-ink-secondary truncate">
                  {identity.musicEnabled && identity.musicPreset !== "none"
                    ? `${(identity.musicSpec || DEFAULT_MUSIC_SPEC).title} (${(identity.musicSpec || DEFAULT_MUSIC_SPEC).genre})`
                    : "Soundtrack Off"}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const spec = identity.musicSpec || DEFAULT_MUSIC_SPEC;
                    const preset =
                      identity.musicPreset && identity.musicPreset !== "none"
                        ? identity.musicPreset
                        : "classic";
                    if (musicPlaying) {
                      musicEngine.stop();
                      onUpdateIdentity({ ...identity, musicEnabled: false });
                    } else {
                      musicEngine.setVolume(identity.musicVolume ?? 42);
                      musicEngine.start(spec);
                      onUpdateIdentity({
                        ...identity,
                        musicEnabled: true,
                        musicPreset: preset,
                        musicSpec: spec,
                      });
                    }
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border cursor-pointer transition-colors ${
                    musicPlaying
                      ? "bg-accent text-accent-fg border-accent"
                      : "bg-surface text-ink-secondary border-edge hover:border-edge-strong"
                  }`}
                >
                  {musicPlaying ? (
                    <>
                      <Pause className="w-3 h-3" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Play Music
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lock Screen / Notification Companion Card */}
        <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-ink">
                Lock Screen Companion
              </h3>
              <p className="text-xs text-ink-muted">
                Set mood phrases to trigger personal reminders &amp; encouragement.
              </p>
            </div>
            <Bell className="w-4 h-4 text-accent-ink" />
          </div>

          {/* Lock Screen Notification Preview */}
          <div className="rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 p-4 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span>{identity.primaryName} ({identity.activeNickname || "AIP"})</span>
              <span className="font-mono-tabular">Now</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-100">
              {lockPreviewText}
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="mood-phrase-input"
              className="block text-xs font-medium text-ink-secondary"
            >
              Custom Lock Screen Phrase
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mood-phrase-input"
                type="text"
                maxLength={160}
                value={guardian.lockScreenMoodPhrase}
                onChange={(e) => {
                  const val = e.target.value;
                  setLockPreviewText(val);
                  onUpdateGuardian({ ...guardian, lockScreenMoodPhrase: val });
                }}
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-ink-secondary">
              Quick Mood Triggers
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_PHRASE_PRESETS.map((preset) => (
                <button
                  key={preset.trigger}
                  type="button"
                  onClick={() => {
                    const personalized = `${callName}: ${preset.quote}`;
                    setLockPreviewText(personalized);
                    setActiveGesture("wink");
                  }}
                  className="px-2.5 py-1 text-xs font-medium bg-surface-alt border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink cursor-pointer"
                >
                  {preset.trigger}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Chat Stream */}
      <div className="lg:col-span-7 flex flex-col gap-3">
        {onUpdateIdentity && (
          <PersonaSwitcher
            identity={identity}
            onSelectPersona={(nextTag, recGesture) => {
              onUpdateIdentity({ ...identity, activeNickname: nextTag });
              setActiveGesture(recGesture);
            }}
          />
        )}

        <div className="bg-surface border border-edge rounded-2xl flex flex-col min-h-[540px] max-h-[680px]">
          <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-edge">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Talk with {identity.primaryName}
              </h2>
              <p className="text-xs text-ink-muted">
                Unfiltered honesty, quick problem-solving, and saved conversation history.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onOpenMemoryViewer && (
                <button
                  type="button"
                  onClick={onOpenMemoryViewer}
                  title="View and edit companion memory"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-secondary bg-surface-alt border border-edge rounded-lg hover:border-edge-strong hover:text-ink cursor-pointer whitespace-nowrap"
                >
                  <Brain className="w-3.5 h-3.5 text-accent-ink" />
                  Memory
                </button>
              )}
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (
                      onSummarizeSession &&
                      userMessageCount >= 2 &&
                      userMessageCount > lastSummarizedUserCountRef.current
                    ) {
                      const persona = resolvePersonaVoiceSpec(
                        identity.activeNickname,
                        identity.primaryName
                      );
                      lastSummarizedUserCountRef.current = userMessageCount;
                      void onSummarizeSession(messages, persona.key, persona.label);
                    }
                    lastSummarizedUserCountRef.current = 0;
                    onClearChat();
                  }}
                  title="Clear conversation history"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-ink-muted bg-surface-alt border border-edge rounded-lg hover:border-edge-strong hover:text-ink cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const activePersona = resolvePersonaVoiceSpec(
                    identity.activeNickname,
                    identity.primaryName
                  );
                  setActiveGesture("laugh");
                  onUpdateMessages([
                    ...messages,
                    {
                      id: `smile-${Date.now()}`,
                      role: "kith",
                      text: `Consider this a smile from ${identity.primaryName}, ${callName}. Whatever is ahead of you today, you're not walking into it alone.`,
                      gesture: "laugh",
                      voiceTone: "warm",
                      personaLabel: activePersona.label,
                      createdAtIso: new Date().toISOString(),
                    },
                  ]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover cursor-pointer whitespace-nowrap shrink-0"
              >
                <Smile className="w-3.5 h-3.5" />
                Get a Smile
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg, idx) => {
              const fallbackTag = identity.nicknames[0] || identity.primaryName;
              const msgTag = msg.personaLabel || fallbackTag;
              const msgPersona = resolvePersonaVoiceSpec(msgTag, identity.primaryName);
              const prevKith =
                msg.role === "kith"
                  ? messages.slice(0, idx).reverse().find((m) => m.role === "kith")
                  : undefined;
              const prevTag = prevKith ? prevKith.personaLabel || fallbackTag : null;
              const showPersonaHeader =
                msg.role === "kith" && (prevKith === undefined || prevTag !== msgTag);
              const isLatestProactive =
                msg.isProactive &&
                !msg.proactiveDismissed &&
                !messages.slice(idx + 1).some((m) => m.isProactive && !m.proactiveDismissed);

              if (msg.isProactive && msg.proactiveDismissed) {
                return (
                  <div
                    key={msg.id}
                    className="flex items-center justify-between text-[11px] text-ink-muted py-1 px-2 border-l-2 border-edge"
                  >
                    <span>
                      Dismissed check-in ({msgPersona.label}) — I&apos;ll check in another time.
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id}
                  id={isLatestProactive ? "proactive-msg-latest" : undefined}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  {msg.isProactive ? (
                    <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${msgPersona.dotClass}`} />
                      <span className="font-semibold text-accent-ink">
                        Checking in · {msgPersona.label}
                      </span>
                    </div>
                  ) : (
                    showPersonaHeader && (
                      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${msgPersona.dotClass}`} />
                        <span className="font-semibold text-ink">{msgPersona.label}</span>
                        <span>· {msgPersona.role}</span>
                      </div>
                    )
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent text-accent-fg"
                        : msg.isProactive
                        ? "bg-accent-soft border border-accent/30 text-ink"
                        : "bg-surface-alt border border-edge text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.evolutionNote && (
                      <p className="mt-2 pt-2 border-t border-edge text-[11px] text-ink-muted">
                        {msg.evolutionNote}
                      </p>
                    )}
                  </div>
                  {msg.role === "kith" && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${msgPersona.dotClass}`} />
                        <span>
                          {msgPersona.label}
                          {msg.gesture ? ` · ${GESTURE_LABELS[msg.gesture].label}` : ""}
                        </span>
                      </span>
                      {msg.isProactive && msg.proactiveTriggerId && onDismissProactive && (
                        <button
                          type="button"
                          onClick={() =>
                            onDismissProactive(msg.id, msg.proactiveTriggerId!)
                          }
                          className="text-ink-muted hover:text-ink underline underline-offset-2 cursor-pointer"
                        >
                          Not now
                        </button>
                      )}
                      {msg.isFallback && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium">
                          Offline fallback
                        </span>
                      )}
                      {identity.voiceSource !== "silent" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleSpeak(msg.text, msg.voiceTone || identity.voiceTone)
                          }
                          className="inline-flex items-center gap-1 text-accent-ink hover:underline cursor-pointer"
                        >
                          <Volume2 className="w-3 h-3" />
                          Speak
                        </button>
                      )}
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          aria-label="Helpful reply"
                          aria-pressed={msg.feedback === "up"}
                          onClick={() => onRateMessage(msg.id, "up")}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            msg.feedback === "up"
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          aria-label="Needs different tone"
                          aria-pressed={msg.feedback === "down"}
                          onClick={() => onRateMessage(msg.id, "down")}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            msg.feedback === "down"
                              ? "text-amber-600 dark:text-amber-400 bg-amber-500/10"
                              : "text-ink-muted hover:text-ink"
                          }`}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {proactivePauseOffer && onRespondPauseProactive && (
              <div className="p-3.5 rounded-xl bg-surface-alt border border-edge flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-ink-secondary">
                  Want me to pause proactive check-ins? You can turn them back on anytime in Guardian Settings.
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onRespondPauseProactive(true)}
                    className="px-2.5 py-1 text-xs font-medium bg-surface border border-edge rounded-lg text-ink hover:border-edge-strong cursor-pointer"
                  >
                    Pause Check-ins
                  </button>
                  <button
                    type="button"
                    onClick={() => onRespondPauseProactive(false)}
                    className="px-2.5 py-1 text-xs font-medium text-accent-ink hover:underline cursor-pointer"
                  >
                    Keep On
                  </button>
                </div>
              </div>
            )}
            {busy && (
              <div className="text-xs text-ink-muted animate-pulse">
                {identity.primaryName} is thinking carefully...
              </div>
            )}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
                {error}
              </div>
            )}
          </div>

        {/* Composer */}
        <div className="p-4 border-t border-edge space-y-2.5">
          {(memoryUpdatedToast || hasUnreadProactive) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {memoryUpdatedToast ? (
                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                  <Brain className="w-3 h-3 text-accent-ink" />
                  {memoryUpdatedToast}
                </span>
              ) : (
                <span />
              )}
              {hasUnreadProactive && (
                <button
                  type="button"
                  onClick={() => {
                    document
                      .getElementById("proactive-msg-latest")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                    onMarkProactiveRead?.();
                  }}
                  className="inline-flex items-center gap-1.5 text-accent-ink font-medium hover:underline cursor-pointer"
                >
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  New check-in above
                </button>
              )}
            </div>
          )}
          {attachment && (
            <div className="flex items-center justify-between px-3 py-1.5 bg-accent-soft rounded-lg text-xs text-accent-ink">
              <span className="truncate">Attached: {attachment.fileName}</span>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="font-medium hover:underline cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <label
              title="Attach image or PDF"
              className="p-2.5 text-ink-muted bg-surface-alt border border-edge rounded-lg hover:border-edge-strong hover:text-ink cursor-pointer shrink-0"
            >
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleAttachment}
                className="sr-only"
              />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`Ask ${identity.primaryName} anything, ${callName}...`}
              className="flex-1 min-w-0 px-3.5 py-2.5 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {voiceDictationSupported && (
              <button
                type="button"
                title={listening ? "Stop voice dictation" : "Dictate message with microphone"}
                aria-pressed={listening}
                onClick={handleToggleDictation}
                className={`p-2.5 border rounded-lg cursor-pointer shrink-0 transition-colors ${
                  listening
                    ? "bg-red-500/15 border-red-400 text-red-500"
                    : "text-ink-muted bg-surface-alt border-edge hover:border-edge-strong hover:text-ink"
                }`}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              type="button"
              disabled={busy || (!input.trim() && !attachment)}
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
