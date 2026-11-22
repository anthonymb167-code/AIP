import type { VisemeId, VoiceSourceId, VoiceTone } from "../types/kith";
import { loadVoiceSample } from "./audioStore";
import { musicEngine } from "./musicEngine";

export interface SpeechFrame {
  energy: number; // 0..1 amplitude
  viseme: VisemeId;
}

export interface CompanionVoiceConfig {
  voiceSource?: VoiceSourceId;
  voicePresetId?: string;
  voiceStylePrompt?: string;
  voiceExternalUrl?: string;
  sampleKey?: string;
  personaKey?: "ally" | "strategist" | "scholar";
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let lipSyncRafId = 0;
let activeAudioCtx: AudioContext | null = null;

function textToVisemeTimeline(text: string): VisemeId[] {
  const frames: VisemeId[] = [];
  const lower = text.toLowerCase();
  for (let i = 0; i < lower.length; i++) {
    const ch = lower[i];
    if ("mbp".includes(ch)) {
      frames.push("mm");
    } else if ("ouwq".includes(ch)) {
      frames.push("oh");
    } else if ("eiy".includes(ch)) {
      frames.push("ee");
    } else if ("a".includes(ch)) {
      frames.push("aa");
    } else if (/[a-z]/.test(ch)) {
      frames.push(i % 3 === 0 ? "aa" : "ee");
    } else if (".,!?;:—-".includes(ch)) {
      frames.push("closed", "closed");
    } else {
      frames.push("closed");
    }
  }
  return frames.length > 0 ? frames : ["closed"];
}

function stopLipSyncDriver(onSpeechFrame?: (frame: SpeechFrame) => void) {
  if (lipSyncRafId) {
    cancelAnimationFrame(lipSyncRafId);
    lipSyncRafId = 0;
  }
  if (activeAudioCtx) {
    activeAudioCtx.close().catch(() => {});
    activeAudioCtx = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  musicEngine.setDucked(false);
  onSpeechFrame?.({ energy: 0, viseme: "closed" });
}

export function stopSpeaking(): void {
  if (lipSyncRafId) {
    cancelAnimationFrame(lipSyncRafId);
    lipSyncRafId = 0;
  }
  if (activeAudioCtx) {
    activeAudioCtx.close().catch(() => {});
    activeAudioCtx = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  musicEngine.setDucked(false);
}

async function attachAudioAndPlay(
  audio: HTMLAudioElement,
  timeline: VisemeId[],
  fallbackTextLength: number,
  onStart?: () => void,
  onEnd?: () => void,
  onSpeechFrame?: (frame: SpeechFrame) => void
): Promise<void> {
  currentAudio = audio;
  let analyser: AnalyserNode | null = null;
  let freqBuffer: Uint8Array<ArrayBuffer> | null = null;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      activeAudioCtx = ctx;
      const src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      freqBuffer = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    }
  } catch {
    analyser = null;
  }

  const startMs = performance.now();
  const estimatedDurationMs = Math.max(1800, fallbackTextLength * 62);
  const visemeCycle: VisemeId[] = ["aa", "ee", "oh", "aa", "mm"];

  const pumpAudioFrames = () => {
    if (currentAudio !== audio || audio.paused || audio.ended) return;
    let energy = 0;
    if (analyser && freqBuffer) {
      analyser.getByteTimeDomainData(freqBuffer);
      let sum = 0;
      for (let i = 0; i < freqBuffer.length; i++) {
        const norm = (freqBuffer[i] - 128) / 128;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / freqBuffer.length);
      energy = Math.min(1, rms * 4.8);
    } else {
      const t = (performance.now() - startMs) / 1000;
      energy = 0.38 + Math.abs(Math.sin(t * 11.5)) * 0.52;
    }

    let viseme: VisemeId = "closed";
    if (energy >= 0.08) {
      if (timeline.length > 1) {
        const totalDur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? audio.duration
            : estimatedDurationMs / 1000;
        const progress = Math.min(0.999, Math.max(0, audio.currentTime / totalDur));
        const idx = Math.floor(progress * timeline.length);
        viseme = timeline[idx] || "aa";
      } else {
        const idx = Math.floor(((performance.now() - startMs) / 115) % visemeCycle.length);
        viseme = visemeCycle[idx];
      }
    }

    onSpeechFrame?.({ energy, viseme });
    lipSyncRafId = requestAnimationFrame(pumpAudioFrames);
  };

  audio.onplay = () => {
    musicEngine.setDucked(true);
    onStart?.();
    lipSyncRafId = requestAnimationFrame(pumpAudioFrames);
  };
  audio.onended = () => {
    currentAudio = null;
    stopLipSyncDriver(onSpeechFrame);
    onEnd?.();
  };
  audio.onerror = () => {
    currentAudio = null;
    stopLipSyncDriver(onSpeechFrame);
    onEnd?.();
  };
  await audio.play();
}

export async function playRecordedVoiceSample(params: {
  sampleKey?: string;
  externalUrl?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onSpeechFrame?: (frame: SpeechFrame) => void;
}): Promise<boolean> {
  stopSpeaking();
  const { sampleKey, externalUrl, onStart, onEnd, onSpeechFrame } = params;

  try {
    if (sampleKey) {
      const stored = await loadVoiceSample(sampleKey);
      if (stored?.blob) {
        const objUrl = URL.createObjectURL(stored.blob);
        currentObjectUrl = objUrl;
        const audio = new Audio(objUrl);
        await attachAudioAndPlay(audio, [], 45, onStart, onEnd, onSpeechFrame);
        return true;
      }
    }

    if (externalUrl && /^https?:\/\//i.test(externalUrl.trim())) {
      const audio = new Audio(externalUrl.trim());
      audio.crossOrigin = "anonymous";
      await attachAudioAndPlay(audio, [], 45, onStart, onEnd, onSpeechFrame);
      return true;
    }
  } catch {
    stopLipSyncDriver(onSpeechFrame);
    onEnd?.();
    return false;
  }

  onEnd?.();
  return false;
}

export async function speakCompanionLine(
  text: string,
  voiceTone: VoiceTone,
  offlineMode: boolean,
  onStart?: () => void,
  onEnd?: () => void,
  onSpeechFrame?: (frame: SpeechFrame) => void,
  gender: "masculine" | "feminine" | "nonbinary" = "masculine",
  voiceConfig?: CompanionVoiceConfig
): Promise<void> {
  stopSpeaking();

  // Optional / silent voice mode: zero audio playback
  if (voiceConfig?.voiceSource === "silent") {
    onSpeechFrame?.({ energy: 0, viseme: "closed" });
    onEnd?.();
    return;
  }

  const cleanText = text.replace(/[“”"]/g, "").trim();
  if (!cleanText) return;

  const timeline = textToVisemeTimeline(cleanText);

  if (!offlineMode && typeof navigator !== "undefined" && navigator.onLine) {
    try {
      onStart?.();
      const res = await fetch("/api/kith/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          voiceTone,
          gender,
          voiceSource: voiceConfig?.voiceSource || "suggested",
          voicePresetId: voiceConfig?.voicePresetId,
          voiceStylePrompt: voiceConfig?.voiceStylePrompt,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          const audio = new Audio(
            `data:${data.mimeType || "audio/wav"};base64,${data.audioBase64}`
          );
          await attachAudioAndPlay(
            audio,
            timeline,
            cleanText.length,
            undefined,
            onEnd,
            onSpeechFrame
          );
          return;
        }
      }
    } catch {
      // Fall back cleanly to Web Speech API or recorded sample below
    }
  }

  // If offline and user uploaded/recorded a direct sample, play it as offline voice fallback
  if (
    voiceConfig &&
    (voiceConfig.voiceSource === "recorded_media" ||
      voiceConfig.voiceSource === "live_mic" ||
      voiceConfig.voiceSource === "own_voice") &&
    (voiceConfig.sampleKey || voiceConfig.voiceExternalUrl)
  ) {
    const played = await playRecordedVoiceSample({
      sampleKey: voiceConfig.sampleKey,
      externalUrl: voiceConfig.voiceExternalUrl,
      onStart,
      onEnd,
      onSpeechFrame,
    });
    if (played) return;
  }

  // Offline / fallback Web Speech API synthesis with persona-matched voices & viseme cadence
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    musicEngine.setDucked(true);
    onStart?.();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    const personaKey = voiceConfig?.personaKey || "ally";
    const personaProfile =
      personaKey === "strategist"
        ? {
            preferredVoices: ["Daniel", "Google UK English Male", "Alex", "Microsoft David"],
            rateOffset: 0.06,
            pitchOffset: -0.05,
          }
        : personaKey === "scholar"
        ? {
            preferredVoices: ["Google US English", "Microsoft Mark", "Fred", "Daniel"],
            rateOffset: -0.08,
            pitchOffset: -0.01,
          }
        : {
            preferredVoices: ["Samantha", "Google UK English Female", "Karen", "Moira"],
            rateOffset: -0.02,
            pitchOffset: 0.04,
          };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const matched = personaProfile.preferredVoices
        .map((pref) =>
          voices.find((v) => v.name.toLowerCase().includes(pref.toLowerCase()))
        )
        .find(Boolean);
      if (matched) {
        utterance.voice = matched;
      }
    }

    const baseRate =
      voiceTone === "excited" ? 1.08 : voiceTone === "calm" ? 0.92 : 1.0;
    utterance.rate = Math.max(0.75, Math.min(1.25, baseRate + personaProfile.rateOffset));
    const basePitch = gender === "feminine" ? 1.14 : gender === "nonbinary" ? 1.02 : 0.92;
    utterance.pitch = Math.max(
      0.7,
      Math.min(
        1.4,
        basePitch +
          personaProfile.pitchOffset +
          (voiceTone === "excited" ? 0.05 : voiceTone === "calm" ? -0.03 : 0)
      )
    );

    const estTotalMs = Math.max(
      1400,
      (cleanText.length * 64) / (utterance.rate || 1)
    );
    const startMs = performance.now();
    let boundaryBoost = 0;

    utterance.onboundary = () => {
      boundaryBoost = 0.35;
    };

    const pumpFallbackFrames = () => {
      const elapsedMs = performance.now() - startMs;
      const progress = Math.min(0.999, elapsedMs / estTotalMs);
      const idx = Math.floor(progress * timeline.length);
      const viseme = timeline[idx] || "aa";
      const syllablePulse = Math.abs(Math.sin(elapsedMs * 0.015));
      boundaryBoost *= 0.88;
      const energy =
        viseme === "closed"
          ? 0.06
          : Math.min(1, 0.25 + syllablePulse * 0.55 + boundaryBoost);
      onSpeechFrame?.({ energy, viseme });
      lipSyncRafId = requestAnimationFrame(pumpFallbackFrames);
    };

    lipSyncRafId = requestAnimationFrame(pumpFallbackFrames);

    utterance.onend = () => {
      stopLipSyncDriver(onSpeechFrame);
      onEnd?.();
    };
    utterance.onerror = () => {
      stopLipSyncDriver(onSpeechFrame);
      onEnd?.();
    };
    window.speechSynthesis.speak(utterance);
  } else {
    stopLipSyncDriver(onSpeechFrame);
    onEnd?.();
  }
}
