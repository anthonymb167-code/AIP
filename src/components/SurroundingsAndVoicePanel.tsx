import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  Sparkles,
  Upload,
  Mic,
  Square,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Wand2,
  Trash2,
  Music,
} from "lucide-react";
import {
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_SPEC,
  DEFAULT_MUSIC_SPEC,
  MUSIC_GENRE_OPTIONS,
  MUSIC_PRESETS,
  PREBUILT_VOICE_CAST,
  VOICE_SOURCE_OPTIONS,
  type BackgroundPresetId,
  type CompanionIdentity,
  type MusicPresetId,
  type VoiceSourceId,
} from "../types/kith";
import {
  blobToBase64,
  deleteVoiceSample,
  getVoiceSampleKey,
  loadVoiceSample,
  saveVoiceSample,
} from "../lib/audioStore";
import { musicEngine } from "../lib/musicEngine";
import { playRecordedVoiceSample, stopSpeaking, type SpeechFrame } from "../lib/voice";

interface SurroundingsAndVoicePanelProps {
  identity: CompanionIdentity;
  userId?: string | null;
  offlineMode: boolean;
  onUpdateIdentity: (next: CompanionIdentity) => void;
  onLogActivity: (summary: string) => void;
  onSpeechPreviewStart: () => void;
  onSpeechPreviewEnd: () => void;
  onSpeechPreviewFrame: (frame: SpeechFrame) => void;
}

export function SurroundingsAndVoicePanel({
  identity,
  userId,
  offlineMode,
  onUpdateIdentity,
  onLogActivity,
  onSpeechPreviewStart,
  onSpeechPreviewEnd,
  onSpeechPreviewFrame,
}: SurroundingsAndVoicePanelProps) {
  // Background generator state
  const [bgPrompt, setBgPrompt] = useState(identity.backgroundPrompt || "");
  const [bgBusy, setBgBusy] = useState(false);
  const [bgError, setBgError] = useState<string | null>(null);

  // Voice recording & analysis state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [hasStoredSample, setHasStoredSample] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Background music generator state
  const [musicPrompt, setMusicPrompt] = useState(identity.musicPrompt || "");
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(() => musicEngine.isPlaying());

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const activeBgPreset = identity.backgroundPreset || "studio_plinth";
  const activeBgSpec = identity.backgroundSpec || DEFAULT_BACKGROUND_SPEC;
  const activeMusicPreset: MusicPresetId = identity.musicPreset || "none";
  const activeMusicSpec = identity.musicSpec || DEFAULT_MUSIC_SPEC;
  const musicEnabled = Boolean(identity.musicEnabled) && activeMusicPreset !== "none";
  const musicVolume = identity.musicVolume ?? 42;
  const voiceSource: VoiceSourceId = identity.voiceSource || "suggested";

  const activeSampleKind: "recorded_media" | "live_mic" | "own_voice" | null =
    voiceSource === "recorded_media" ||
    voiceSource === "live_mic" ||
    voiceSource === "own_voice"
      ? voiceSource
      : null;

  useEffect(() => {
    setBgPrompt(identity.backgroundPrompt || "");
  }, [identity.backgroundPrompt]);

  useEffect(() => {
    setMusicPrompt(identity.musicPrompt || "");
  }, [identity.musicPrompt]);

  useEffect(() => {
    return musicEngine.subscribe((playing) => {
      setMusicPlaying(playing);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function checkSample() {
      if (!activeSampleKind) {
        setHasStoredSample(false);
        return;
      }
      try {
        const key = getVoiceSampleKey(activeSampleKind, userId);
        const found = await loadVoiceSample(key);
        if (!cancelled) {
          setHasStoredSample(Boolean(found));
        }
      } catch {
        if (!cancelled) setHasStoredSample(false);
      }
    }
    checkSample();
    return () => {
      cancelled = true;
    };
  }, [activeSampleKind, userId, identity.voiceSampleLabel]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  function handleSelectBgPreset(presetId: Exclude<BackgroundPresetId, "custom">) {
    const spec = BACKGROUND_PRESETS[presetId];
    onUpdateIdentity({
      ...identity,
      backgroundPreset: presetId,
      backgroundSpec: spec,
    });
    setBgError(null);
  }

  async function handleGenerateBackground() {
    if (!bgPrompt.trim()) return;
    setBgBusy(true);
    setBgError(null);
    try {
      const res = await fetch("/api/kith/background", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: bgPrompt.trim(), identity }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to generate surroundings.");
      }
      onUpdateIdentity({
        ...identity,
        backgroundPreset: "custom",
        backgroundPrompt: bgPrompt.trim(),
        backgroundSpec: data,
      });
      onLogActivity(`Generated avatar surroundings: ${data.title}`);
    } catch (err) {
      setBgError(
        err instanceof Error ? err.message : "Could not generate surroundings."
      );
    } finally {
      setBgBusy(false);
    }
  }

  function handleSelectMusicGenre(presetId: Exclude<MusicPresetId, "custom">) {
    setMusicError(null);
    if (presetId === "none") {
      musicEngine.stop();
      onUpdateIdentity({
        ...identity,
        musicPreset: "none",
        musicEnabled: false,
      });
      return;
    }
    const spec = MUSIC_PRESETS[presetId];
    musicEngine.setVolume(musicVolume);
    musicEngine.start(spec);
    onUpdateIdentity({
      ...identity,
      musicPreset: presetId,
      musicEnabled: true,
      musicSpec: spec,
    });
  }

  function handleToggleMusicPlayback() {
    if (!musicEnabled) {
      const nextPreset =
        activeMusicPreset === "none" ? "classic" : activeMusicPreset;
      const specToPlay =
        nextPreset === "custom" ? activeMusicSpec : MUSIC_PRESETS[nextPreset];
      musicEngine.setVolume(musicVolume);
      musicEngine.start(specToPlay);
      onUpdateIdentity({
        ...identity,
        musicPreset: nextPreset,
        musicEnabled: true,
        musicSpec: specToPlay,
      });
      return;
    }

    if (musicEngine.isPlaying()) {
      musicEngine.stop();
    } else {
      musicEngine.setVolume(musicVolume);
      musicEngine.start(activeMusicSpec);
    }
  }

  async function handleGenerateMusic() {
    if (!musicPrompt.trim()) return;
    setMusicBusy(true);
    setMusicError(null);
    try {
      const res = await fetch("/api/kith/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: musicPrompt.trim(), identity }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to generate background music.");
      }
      musicEngine.setVolume(musicVolume);
      musicEngine.start(data);
      onUpdateIdentity({
        ...identity,
        musicPreset: "custom",
        musicEnabled: true,
        musicPrompt: musicPrompt.trim(),
        musicSpec: data,
      });
      onLogActivity(`Generated background soundtrack: ${data.title} (${data.genre})`);
    } catch (err) {
      setMusicError(
        err instanceof Error ? err.message : "Could not generate background music."
      );
    } finally {
      setMusicBusy(false);
    }
  }

  function handleSelectVoiceSource(nextSource: VoiceSourceId) {
    stopSpeaking();
    onSpeechPreviewEnd();
    setVoiceError(null);
    setVoiceMessage(null);
    onUpdateIdentity({
      ...identity,
      voiceSource: nextSource,
      voiceAutoSpeak:
        nextSource === "silent" ? false : identity.voiceAutoSpeak,
    });
  }

  async function handleAudioFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setVoiceError(null);
    setVoiceMessage(null);
    try {
      const key = getVoiceSampleKey("recorded_media", userId);
      await saveVoiceSample({
        key,
        label: file.name.slice(0, 100),
        mimeType: file.type || "audio/mpeg",
        sourceKind: "recorded_media",
        blob: file,
        updatedAtIso: new Date().toISOString(),
      });
      setHasStoredSample(true);
      onUpdateIdentity({
        ...identity,
        voiceSource: "recorded_media",
        voiceSampleLabel: file.name.slice(0, 100),
      });
      setVoiceMessage(`Loaded "${file.name}" for playback & voice matching.`);
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "Unable to store uploaded audio."
      );
    }
  }

  async function handleStartRecording(kind: "live_mic" | "own_voice") {
    setVoiceError(null);
    setVoiceMessage(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError("Live microphone recording is not supported in this browser.");
      return;
    }

    try {
      stopSpeaking();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };
      recorder.onstop = async () => {
        if (recordTimerRef.current) {
          window.clearInterval(recordTimerRef.current);
          recordTimerRef.current = null;
        }
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);

        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (blob.size < 100) return;

        const label =
          kind === "own_voice"
            ? `My Own Voice (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
            : `Live Studio Take (${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
        try {
          const key = getVoiceSampleKey(kind, userId);
          await saveVoiceSample({
            key,
            label,
            mimeType: blob.type || "audio/webm",
            sourceKind: kind,
            blob,
            updatedAtIso: new Date().toISOString(),
          });
          setHasStoredSample(true);
          onUpdateIdentity({
            ...identity,
            voiceSource: kind,
            voiceSampleLabel: label.slice(0, 100),
          });
          setVoiceMessage(`Saved ${label}. Click "Play Sample" to test lip-sync or "Match Voice" to calibrate replies.`);
        } catch (err) {
          setVoiceError(
            err instanceof Error ? err.message : "Could not save live recording."
          );
        }
      };

      mediaRecorderRef.current = recorder;
      setRecordSeconds(0);
      setIsRecording(true);
      recorder.start();
      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((s) => {
          if (s >= 45) {
            recorder.stop();
            return s;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setVoiceError("Microphone permission was denied or unavailable.");
      setIsRecording(false);
    }
  }

  function handleStopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  async function handlePlaySample() {
    if (!activeSampleKind) return;
    setVoiceError(null);
    const key = getVoiceSampleKey(activeSampleKind, userId);
    const ok = await playRecordedVoiceSample({
      sampleKey: hasStoredSample ? key : undefined,
      externalUrl: identity.voiceExternalUrl,
      onStart: onSpeechPreviewStart,
      onEnd: onSpeechPreviewEnd,
      onSpeechFrame: onSpeechPreviewFrame,
    });
    if (!ok) {
      setVoiceError(
        "No playable local recording or accessible HTTPS audio URL was found."
      );
    }
  }

  async function handleClearSample() {
    if (!activeSampleKind) return;
    stopSpeaking();
    onSpeechPreviewEnd();
    const key = getVoiceSampleKey(activeSampleKind, userId);
    await deleteVoiceSample(key).catch(() => {});
    setHasStoredSample(false);
    onUpdateIdentity({
      ...identity,
      voiceSampleLabel: "",
      voiceExternalUrl: "",
    });
    setVoiceMessage("Cleared saved audio sample.");
  }

  async function handleAnalyzeAndMatchVoice() {
    if (!activeSampleKind) return;
    setVoiceBusy(true);
    setVoiceError(null);
    setVoiceMessage(null);
    try {
      const key = getVoiceSampleKey(activeSampleKind, userId);
      const stored = hasStoredSample ? await loadVoiceSample(key) : null;

      let attachment: { data: string; mimeType: string } | undefined;
      if (stored?.blob) {
        if (stored.blob.size > 9 * 1024 * 1024) {
          throw new Error("Audio file is over 9 MB. Trim to a short clip for voice matching.");
        }
        const base64 = await blobToBase64(stored.blob);
        attachment = {
          data: base64,
          mimeType: stored.mimeType || "audio/webm",
        };
      }

      const description =
        identity.voiceStylePrompt?.trim() ||
        identity.voiceSampleLabel ||
        identity.voiceExternalUrl ||
        "";

      if (!attachment && !description) {
        throw new Error("Upload/record an audio clip or enter vocal notes first.");
      }

      const res = await fetch("/api/kith/voice-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attachment,
          description,
          sourceKind: activeSampleKind,
          identity,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to analyze audio sample.");
      }

      onUpdateIdentity({
        ...identity,
        voicePresetId: data.recommendedVoiceName || identity.voicePresetId,
        voiceStylePrompt: data.stylePrompt || identity.voiceStylePrompt,
      });
      setVoiceMessage(
        `Matched cast timbre "${data.recommendedVoiceName}": ${data.cadenceSummary}`
      );
      onLogActivity(`Calibrated ${identity.primaryName}'s voice from ${activeSampleKind}`);
    } catch (err) {
      setVoiceError(
        err instanceof Error ? err.message : "Could not match voice sample."
      );
    } finally {
      setVoiceBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 06. Avatar Surroundings & Background Generator */}
      <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              06. Avatar Surroundings &amp; Background Generator
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Choose a setting or generate custom surroundings—lighting, atmosphere, and 3D/2D architecture update live.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 pt-1">
            <span
              className="w-3.5 h-3.5 rounded-full border border-edge-strong"
              style={{ backgroundColor: activeBgSpec.skyTopHex }}
              title="Sky / Backdrop Top"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-edge-strong"
              style={{ backgroundColor: activeBgSpec.keyLightHex }}
              title="Key Light"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-edge-strong"
              style={{ backgroundColor: activeBgSpec.rimLightHex }}
              title="Rim Light"
            />
          </div>
        </div>

        {/* Preset Surroundings Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {(Object.keys(BACKGROUND_PRESETS) as Exclude<BackgroundPresetId, "custom">[]).map(
            (key) => {
              const preset = BACKGROUND_PRESETS[key];
              const selected = activeBgPreset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectBgPreset(key)}
                  className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                    selected
                      ? "bg-accent-soft border-accent text-ink"
                      : "bg-surface-alt border-edge text-ink-secondary hover:border-edge-strong"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm shrink-0 border border-edge-strong"
                      style={{
                        background: `linear-gradient(135deg, ${preset.skyTopHex}, ${preset.skyBottomHex})`,
                      }}
                    />
                    <span className="text-xs font-semibold truncate">
                      {preset.title}
                    </span>
                  </div>
                </button>
              );
            }
          )}
        </div>

        {/* Custom AI Surroundings Generator */}
        <div className="space-y-2.5 pt-1">
          <label
            htmlFor="bg-generator-prompt"
            className="block text-xs font-medium text-ink-secondary"
          >
            Describe Any Surroundings
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Standing in a glowing evening city avenue",
              "On a wooden boat drifting on a river",
              "In a lush sunlit tropical jungle",
              "Standing on an ancient desert pyramid",
              "Exploring red craters on Mars planet",
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setBgPrompt(idea)}
                className="px-2.5 py-1 text-[11px] font-medium bg-surface-alt border border-edge rounded-md text-ink-secondary hover:border-accent hover:text-ink transition-colors cursor-pointer"
              >
                {idea}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="bg-generator-prompt"
              type="text"
              maxLength={240}
              value={bgPrompt}
              onChange={(e) => setBgPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGenerateBackground();
                }
              }}
              placeholder="e.g., On a boat in a river at dusk, in a bustling city, in a jungle, on Mars..."
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              disabled={bgBusy || offlineMode || !bgPrompt.trim()}
              onClick={handleGenerateBackground}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {bgBusy ? "Generating..." : "Generate Scene"}
            </button>
          </div>
          <p className="text-[11px] text-ink-muted leading-relaxed">
            Active: <span className="font-semibold text-ink">{activeBgSpec.title}</span> — {activeBgSpec.description}
          </p>
          {bgError && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {bgError}
            </div>
          )}
        </div>
      </section>

      {/* 07. Optional Voice & Multi-Source Audio Studio */}
      <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              07. Optional Voice &amp; Audio Source
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Voice is completely optional—pick a suggested voice, choose from the cast, import tape/CD/online audio, record live, or use your own voice.
            </p>
          </div>
          {voiceSource === "silent" ? (
            <VolumeX className="w-4 h-4 text-ink-muted shrink-0 mt-1" />
          ) : (
            <Volume2 className="w-4 h-4 text-accent-ink shrink-0 mt-1" />
          )}
        </div>

        {/* Source Option Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VOICE_SOURCE_OPTIONS.map((opt) => {
            const selected = voiceSource === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectVoiceSource(opt.id)}
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  selected
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                }`}
              >
                <div className="text-xs font-semibold truncate">{opt.label}</div>
                <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2">
                  {opt.shortDesc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sub-controls for Infinite Voice Cast */}
        {voiceSource === "preset_cast" && (
          <div className="p-3.5 rounded-xl bg-surface-alt border border-edge space-y-3">
            <div className="text-xs font-semibold text-ink">
              Select Cast Voice
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PREBUILT_VOICE_CAST.map((v) => {
                const active = (identity.voicePresetId || "Charon") === v.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() =>
                      onUpdateIdentity({ ...identity, voicePresetId: v.id })
                    }
                    className={`p-2 rounded-lg border text-left transition-colors cursor-pointer ${
                      active
                        ? "bg-surface border-accent text-ink ring-1 ring-accent/40"
                        : "bg-surface/60 border-edge text-ink-muted hover:border-edge-strong"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{v.label}</span>
                      <span className="text-[11px] font-normal text-accent-ink">
                        {v.register}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted mt-0.5 truncate">
                      {v.vibe}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <label
                htmlFor="custom-voice-style"
                className="block text-xs font-medium text-ink-secondary"
              >
                Custom Vocal Delivery Note (Optional)
              </label>
              <input
                id="custom-voice-style"
                type="text"
                maxLength={240}
                value={identity.voiceStylePrompt || ""}
                onChange={(e) =>
                  onUpdateIdentity({
                    ...identity,
                    voiceStylePrompt: e.target.value,
                  })
                }
                placeholder="e.g., Soft-spoken British bookshop warmth with an amused smile..."
                className="w-full px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        )}

        {/* Sub-controls for Digitized Tape / CD / File / Online URL */}
        {voiceSource === "recorded_media" && (
          <div className="p-3.5 rounded-xl bg-surface-alt border border-edge space-y-3">
            <div className="text-xs text-ink-secondary leading-relaxed">
              Import digitized cassette tapes, CDs, voice memos (MP3/WAV/M4A/OGG), or paste an online audio URL. Play it directly with live lip-sync or match {identity.primaryName}'s voice to it.
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink bg-surface border border-edge rounded-lg hover:border-accent cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-accent-ink" />
                <span>
                  {identity.voiceSampleLabel || "Upload Tape / CD Audio"}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleAudioFileUpload}
                  className="sr-only"
                />
              </label>

              {(hasStoredSample || identity.voiceExternalUrl) && (
                <>
                  <button
                    type="button"
                    onClick={handlePlaySample}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Play Sample
                  </button>
                  <button
                    type="button"
                    disabled={voiceBusy || offlineMode}
                    onClick={handleAnalyzeAndMatchVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {voiceBusy ? "Matching..." : "Match Voice"}
                  </button>
                  <button
                    type="button"
                    aria-label="Clear audio sample"
                    onClick={handleClearSample}
                    className="p-2 text-ink-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="external-audio-url"
                className="block text-xs font-medium text-ink-secondary"
              >
                Or Online Audio Stream / Clip URL (HTTPS)
              </label>
              <input
                id="external-audio-url"
                type="url"
                maxLength={300}
                value={identity.voiceExternalUrl || ""}
                onChange={(e) =>
                  onUpdateIdentity({
                    ...identity,
                    voiceExternalUrl: e.target.value,
                  })
                }
                placeholder="https://example.com/voice-clip.mp3"
                className="w-full px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
        )}

        {/* Sub-controls for Live Mic Recording OR User's Own Voice */}
        {(voiceSource === "live_mic" || voiceSource === "own_voice") && (
          <div className="p-3.5 rounded-xl bg-surface-alt border border-edge space-y-3">
            <div className="text-xs text-ink-secondary leading-relaxed">
              {voiceSource === "own_voice"
                ? "Record a few sentences in your own voice. Your avatar can play your recording with live lip-sync and adapt conversational speech to match your cadence."
                : "Record a live voice performance right from your microphone to give this avatar an original vocal signature."}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={() => handleStartRecording(voiceSource)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  {hasStoredSample ? "Re-Record Live" : "Start Live Recording"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStopRecording}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-red-700 rounded-lg hover:bg-red-800 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Stop ({recordSeconds}s)
                </button>
              )}

              {hasStoredSample && !isRecording && (
                <>
                  <button
                    type="button"
                    onClick={handlePlaySample}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink bg-surface border border-edge rounded-lg hover:border-accent cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-accent-ink" />
                    Play Recording
                  </button>
                  <button
                    type="button"
                    disabled={voiceBusy || offlineMode}
                    onClick={handleAnalyzeAndMatchVoice}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover disabled:opacity-50 cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    {voiceBusy ? "Matching..." : "Match Voice"}
                  </button>
                  <button
                    type="button"
                    aria-label="Delete saved voice recording"
                    onClick={handleClearSample}
                    className="p-2 text-ink-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {identity.voiceSampleLabel && (
              <div className="text-[11px] text-ink-muted">
                Saved clip: <span className="font-medium text-ink">{identity.voiceSampleLabel}</span>
              </div>
            )}
          </div>
        )}

        {/* Auto-Speak toggle when voice is enabled */}
        {voiceSource !== "silent" ? (
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-edge">
            <div>
              <div className="text-xs font-medium text-ink">
                Auto-Speak Live Companion Replies
              </div>
              <div className="text-[11px] text-ink-muted">
                Automatically read replies aloud in Live Companion (optional; you can always click Speak manually).
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(identity.voiceAutoSpeak)}
              onClick={() =>
                onUpdateIdentity({
                  ...identity,
                  voiceAutoSpeak: !identity.voiceAutoSpeak,
                })
              }
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                identity.voiceAutoSpeak ? "bg-accent" : "bg-edge-strong"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  identity.voiceAutoSpeak ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-surface-alt border border-edge text-xs text-ink-muted">
            Silent mode active — {identity.primaryName} communicates via text and animated facial expressions without spoken audio.
          </div>
        )}

        {voiceMessage && (
          <div className="p-2.5 rounded-lg bg-accent-soft border border-edge text-xs text-ink">
            {voiceMessage}
          </div>
        )}
        {voiceError && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {voiceError}
          </div>
        )}
      </section>

      {/* 08. Optional Background Music & Soundtrack Generator */}
      <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              08. Optional Background Music &amp; Generator
            </h2>
            <p className="text-xs text-ink-muted mt-0.5">
              Optional soundtrack—pick classic, pop, rap, soft country, electronic, instrumental, or describe any mood to compose a live score.
            </p>
          </div>
          <Music
            className={`w-4 h-4 shrink-0 mt-1 ${
              musicPlaying ? "text-accent-ink" : "text-ink-muted"
            }`}
          />
        </div>

        {/* Genre Presets Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MUSIC_GENRE_OPTIONS.map((opt) => {
            const selected =
              opt.id === "none"
                ? !musicEnabled
                : musicEnabled && activeMusicPreset === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() =>
                  handleSelectMusicGenre(
                    opt.id as Exclude<MusicPresetId, "custom">
                  )
                }
                className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                  selected
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                }`}
              >
                <div className="text-xs font-semibold truncate">{opt.label}</div>
                <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2">
                  {opt.shortDesc}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Music Description Generator */}
        <div className="space-y-2.5 pt-1">
          <label
            htmlFor="music-generator-prompt"
            className="block text-xs font-medium text-ink-secondary"
          >
            Describe Any Background Music
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Warm classical piano and cello nocturne",
              "Upbeat modern pop synth groove",
              "Chill 90s boom-bap rap beat with warm piano",
              "Soft acoustic country guitar on a quiet porch",
              "Dreamy electronic chillwave synth pulse",
              "Peaceful solo flute and soft strings instrumental",
            ].map((idea) => (
              <button
                key={idea}
                type="button"
                onClick={() => setMusicPrompt(idea)}
                className="px-2.5 py-1 text-[11px] font-medium bg-surface-alt border border-edge rounded-md text-ink-secondary hover:border-accent hover:text-ink transition-colors cursor-pointer"
              >
                {idea}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              id="music-generator-prompt"
              type="text"
              maxLength={240}
              value={musicPrompt}
              onChange={(e) => setMusicPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleGenerateMusic();
                }
              }}
              placeholder="e.g., Soft acoustic country sunset, smooth rap beat, upbeat pop, classic strings..."
              className="flex-1 min-w-0 px-3 py-2 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="button"
              disabled={musicBusy || offlineMode || !musicPrompt.trim()}
              onClick={handleGenerateMusic}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {musicBusy ? "Composing..." : "Generate Music"}
            </button>
          </div>
        </div>

        {/* Active Playback & Volume Control */}
        <div className="pt-3 border-t border-edge space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink truncate">
                {musicEnabled
                  ? activeMusicSpec.title
                  : "Background Music Off (Optional)"}
              </div>
              <div className="text-[11px] text-ink-muted truncate">
                {musicEnabled
                  ? `${activeMusicSpec.genre.toUpperCase()} · ${activeMusicSpec.bpm} BPM · ${activeMusicSpec.leadInstrument.replace("_", " ")} · Auto-ducks when speaking`
                  : "Choose any genre above or describe a track to compose and play it."}
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleMusicPlayback}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                musicPlaying
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
              }`}
            >
              {musicPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5" />
                  Pause Music
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  {musicEnabled ? "Resume Music" : "Play Music"}
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="music-volume-slider"
              className="text-xs font-medium text-ink-secondary whitespace-nowrap"
            >
              Music Volume
            </label>
            <input
              id="music-volume-slider"
              type="range"
              min={0}
              max={100}
              value={musicVolume}
              onChange={(e) => {
                const vol = Number(e.target.value);
                musicEngine.setVolume(vol);
                onUpdateIdentity({
                  ...identity,
                  musicVolume: vol,
                });
              }}
              className="flex-1 kith-slider"
            />
            <span className="font-mono-tabular text-xs font-medium text-ink w-9 text-right">
              {musicVolume}%
            </span>
          </div>
        </div>

        {musicError && (
          <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {musicError}
          </div>
        )}
      </section>
    </div>
  );
}
