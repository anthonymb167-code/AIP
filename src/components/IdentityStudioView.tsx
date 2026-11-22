import { useState, type ChangeEvent } from "react";
import {
  Volume2,
  Sparkles,
  Upload,
  RefreshCw,
  Plus,
  X,
  Check,
  ArrowRight,
  Lock,
  Globe,
  BookOpen,
  Stethoscope,
  Cpu,
  Film,
  Briefcase,
  Wrench,
  Puzzle,
  Eye,
  Compass,
  Heart,
  TrendingUp,
  Palette,
} from "lucide-react";
import {
  AGE_BAND_ORDER,
  AGE_BAND_PROFILES,
  ARCHETYPES,
  CORE_ANCHORS,
  DECADE_STAGES,
  DEFAULT_RIG_MOTION_CONFIG,
  FACIAL_RIG_STATES,
  GENDER_OPTIONS,
  GESTURE_LABELS,
  INDUSTRIES,
  INDUSTRY_ORDER,
  LIFE_FOCUS_OPTIONS,
  UNIVERSAL_MODULES,
  computeFocusWeights,
  getGenderPronouns,
  hasIndustryWorkspace,
  hasSchoolFocus,
  type AgeBandId,
  type ArchetypeId,
  type CompanionGender,
  type CompanionIdentity,
  type GestureId,
  type IndustryId,
  type LearnedPreferences,
  type LifeFocusId,
  type RigMotionConfig,
  type StudioTab,
  type VisemeId,
  type VoiceTone,
} from "../types/kith";
import { CompanionStageAvatar, type StageViewMode } from "./CompanionStageAvatar";
import { AvatarArchitecturePanel } from "./AvatarArchitecturePanel";
import { FocusBalanceCard } from "./FocusBalanceCard";
import { SurroundingsAndVoicePanel } from "./SurroundingsAndVoicePanel";
import { PortraitMode } from "./PortraitMode";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { PaletteSwatch, PaletteSwatchInline } from "./PaletteSwatch";
import { getVoiceSampleKey } from "../lib/audioStore";
import { speakCompanionLine } from "../lib/voice";
import { APP_COPY, type GentleNudgeVariant } from "../lib/copy";

interface IdentityStudioViewProps {
  identity: CompanionIdentity;
  userId?: string | null;
  onUpdateIdentity: (next: CompanionIdentity) => void;
  offlineMode: boolean;
  onLogActivity: (summary: string) => void;
  onOpenTab?: (tab: StudioTab, moduleId?: string) => void;
  learnedPreferences?: LearnedPreferences;
  chatMessageCount?: number;
  onClearLearnedPreferences?: () => void;
  onOpenShareModal?: () => void;
  gentleNudge?: {
    variant: GentleNudgeVariant;
    onCustomize: () => void;
    onDismiss: () => void;
  } | null;
  onBrowseArchetypes?: () => void;
}

function getIndustryIcon(industryId: IndustryId) {
  switch (industryId) {
    case "SCHOOL":
      return BookOpen;
    case "MEDICAL":
      return Stethoscope;
    case "TECH":
      return Cpu;
    case "CREATIVE":
      return Film;
    case "BUSINESS":
      return Briefcase;
    case "TRADES":
      return Wrench;
    case "OTHER":
      return Puzzle;
    default:
      return Globe;
  }
}

function getUniversalModuleIcon(id: "everyday" | "creative" | "mindfulness" | "growth") {
  switch (id) {
    case "everyday":
      return Compass;
    case "creative":
      return Sparkles;
    case "mindfulness":
      return Heart;
    case "growth":
      return TrendingUp;
  }
}

export function IdentityStudioView({
  identity,
  userId,
  onUpdateIdentity,
  offlineMode,
  onLogActivity,
  onOpenTab,
  learnedPreferences,
  chatMessageCount = 0,
  onClearLearnedPreferences,
  onOpenShareModal,
  gentleNudge,
  onBrowseArchetypes,
}: IdentityStudioViewProps) {
  const [viewMode, setViewMode] = useState<StageViewMode>("3d");
  const [gesture, setGesture] = useState<GestureId>("warm_nod");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechEnergy, setSpeechEnergy] = useState(0);
  const [speechViseme, setSpeechViseme] = useState<VisemeId>("closed");
  const [rigConfig, setRigConfig] = useState<RigMotionConfig>(DEFAULT_RIG_MOTION_CONFIG);
  const [newNickname, setNewNickname] = useState("");
  const [tuneDescription, setTuneDescription] = useState("");
  const [tuneAttachment, setTuneAttachment] = useState<{
    data: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [tuningBusy, setTuningBusy] = useState(false);
  const [tuningMessage, setTuningMessage] = useState<string | null>(null);
  const [tuningError, setTuningError] = useState<string | null>(null);
  const [previewIndustryTiles, setPreviewIndustryTiles] = useState(false);
  const [showArchetypePalette, setShowArchetypePalette] = useState(false);

  const arch = ARCHETYPES[identity.archetype];
  const gender: CompanionGender = identity.gender || "masculine";
  const pronouns = getGenderPronouns(gender);
  const selectedIndustry: IndustryId = identity.selectedIndustry || "NONE";
  const industrySpec = INDUSTRIES[selectedIndustry] || INDUSTRIES.NONE;
  const enabledModuleIds = identity.enabledIndustryModules || [];
  const enabledIndustryModules = industrySpec.modules.filter((m) =>
    enabledModuleIds.includes(m.id)
  );
  const previewOnlyIndustryModules =
    previewIndustryTiles && selectedIndustry !== "NONE"
      ? industrySpec.modules.filter((m) => !enabledModuleIds.includes(m.id))
      : [];
  const showStudyLab = hasSchoolFocus(identity);
  const showIndustryDesk = hasIndustryWorkspace(identity);
  const IndustryIcon = getIndustryIcon(selectedIndustry);
  const genderCuratedNames = arch.curatedNamesByGender?.[gender] || arch.curatedNames;
  const genderSelfName = arch.selfChosenNameByGender?.[gender] || arch.selfChosenName;
  const decadeSpec = DECADE_STAGES[identity.decadeStage] || DECADE_STAGES[0];
  const stageSpeech = decadeSpec.buildScript(
    identity.primaryName || genderSelfName,
    identity.activeNickname,
    arch.shortLabel
  );

  function handleSelectGender(nextGender: CompanionGender) {
    const allPresetNames = Object.values(ARCHETYPES).flatMap((spec) => [
      ...spec.curatedNames,
      ...(spec.curatedNamesByGender
        ? Object.values(spec.curatedNamesByGender).flat()
        : []),
    ]);
    const isUsingPresetName = allPresetNames.includes(identity.primaryName);
    const nextSuggested =
      arch.selfChosenNameByGender?.[nextGender] || arch.selfChosenName;
    const nextPrimaryName =
      identity.letHimChoose || isUsingPresetName
        ? nextSuggested
        : identity.primaryName;

    // Automatically align pitch default when gender changes if not manually set to a custom value
    let nextPitch = identity.voicePitch;
    if (nextGender === "masculine" && (nextPitch === undefined || nextPitch === 1.15)) {
      nextPitch = 0.9;
    } else if (nextGender === "feminine" && (nextPitch === undefined || nextPitch === 0.9)) {
      nextPitch = 1.15;
    } else if (nextGender === "nonbinary" && (nextPitch === undefined || nextPitch === 0.9 || nextPitch === 1.15)) {
      nextPitch = 1.0;
    }

    onUpdateIdentity({
      ...identity,
      gender: nextGender,
      primaryName: nextPrimaryName,
      voicePitch: nextPitch,
    });
    setGesture("warm_nod");
  }

  function handleSelectArchetype(archId: ArchetypeId) {
    const spec = ARCHETYPES[archId];
    const nextPrimaryName = identity.letHimChoose
      ? spec.selfChosenNameByGender?.[gender] || spec.selfChosenName
      : identity.primaryName;
    onUpdateIdentity({
      ...identity,
      archetype: archId,
      primaryName: nextPrimaryName,
      coatLayering: spec.defaultSliders.coatLayering,
      hairLength: spec.defaultSliders.hairLength,
      accessoryDetail: spec.defaultSliders.accessoryDetail,
      warmthHumor: spec.defaultSliders.warmthHumor,
      scholarlyDepth: spec.defaultSliders.scholarlyDepth,
      voiceTone: spec.defaultSliders.voiceTone,
    });
    setGesture("smirk");
    setTuningMessage(
      identity.letHimChoose
        ? spec.selfChoiceReason
        : `Switched template to ${spec.label}.`
    );
  }

  function handleSuggestName() {
    const pool = genderCuratedNames;
    const currentIndex = pool.indexOf(identity.primaryName);
    const nextName = pool[(currentIndex + 1) % pool.length];
    onUpdateIdentity({
      ...identity,
      letHimChoose: false,
      primaryName: nextName,
    });
    setGesture("wink");
  }

  function handleToggleLetHimChoose() {
    const nextFlag = !identity.letHimChoose;
    if (nextFlag) {
      onUpdateIdentity({
        ...identity,
        letHimChoose: true,
        primaryName: genderSelfName,
      });
      setGesture("warm_nod");
      setTuningMessage(arch.selfChoiceReason);
    } else {
      onUpdateIdentity({
        ...identity,
        letHimChoose: false,
      });
    }
  }

  function handleAddNickname() {
    const clean = newNickname.trim().slice(0, 32);
    if (!clean) return;
    if (identity.nicknames.length >= 10) return;
    const exists = identity.nicknames.some(
      (n) => n.toLowerCase() === clean.toLowerCase()
    );
    const updatedList = exists ? identity.nicknames : [...identity.nicknames, clean];
    onUpdateIdentity({
      ...identity,
      nicknames: updatedList,
      activeNickname: clean,
    });
    setNewNickname("");
    setGesture("laugh");
  }

  function handleRemoveNickname(tag: string) {
    const updatedList = identity.nicknames.filter((n) => n !== tag);
    const nextActive =
      identity.activeNickname === tag
        ? updatedList[0] || ""
        : identity.activeNickname;
    onUpdateIdentity({
      ...identity,
      nicknames: updatedList,
      activeNickname: nextActive,
    });
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      setTuneAttachment({
        data: base64,
        mimeType: file.type || "image/jpeg",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleRunSelfTune() {
    if (!tuneDescription.trim() && !tuneAttachment) return;
    setTuningBusy(true);
    setTuningError(null);
    setTuningMessage(null);
    try {
      const res = await fetch("/api/kith/tune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: tuneDescription,
          identity,
          attachment: tuneAttachment
            ? { data: tuneAttachment.data, mimeType: tuneAttachment.mimeType }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to self-tune right now.");
      }
      const nextNick = data.suggestedNickname?.trim().slice(0, 32);
      const updatedNicknames =
        nextNick &&
        !identity.nicknames.some((n) => n.toLowerCase() === nextNick.toLowerCase()) &&
        identity.nicknames.length < 10
          ? [...identity.nicknames, nextNick]
          : identity.nicknames;

      const inferredLifeFocus: LifeFocusId =
        data.lifeFocus && data.lifeFocus !== "student"
          ? data.lifeFocus
          : identity.lifeFocus === "student"
          ? "general"
          : identity.lifeFocus;

      onUpdateIdentity({
        ...identity,
        archetype: data.archetype || identity.archetype,
        lifeFocus: inferredLifeFocus,
        coatLayering: data.coatLayering,
        hairLength: data.hairLength,
        accessoryDetail: data.accessoryDetail,
        warmthHumor: data.warmthHumor,
        scholarlyDepth: data.scholarlyDepth,
        voiceTone: data.voiceTone || identity.voiceTone,
        nicknames: updatedNicknames,
        activeNickname: nextNick || identity.activeNickname,
      });
      setGesture((data.gesture as GestureId) || "smirk");
      setTuningMessage(data.reflection);
      onLogActivity(`Evolved identity look & temperament (${data.archetype})`);
    } catch (err) {
      setTuningError(
        err instanceof Error ? err.message : "Could not connect for self-tuning."
      );
    } finally {
      setTuningBusy(false);
    }
  }

  async function handleSpeakStage() {
    if (identity.voiceSource === "silent") return;
    const sampleKind =
      identity.voiceSource === "recorded_media" ||
      identity.voiceSource === "live_mic" ||
      identity.voiceSource === "own_voice"
        ? identity.voiceSource
        : null;
    await speakCompanionLine(
      stageSpeech,
      identity.voiceTone,
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
      gender,
      {
        voiceSource: identity.voiceSource,
        voicePresetId: identity.voicePresetId,
        voiceStylePrompt: identity.voiceStylePrompt,
        voiceExternalUrl: identity.voiceExternalUrl,
        sampleKey: sampleKind ? getVoiceSampleKey(sampleKind, userId) : undefined,
        pitch: identity.voicePitch,
      }
    );
  }

  const activeRigSpec = FACIAL_RIG_STATES[gesture] || FACIAL_RIG_STATES.warm_nod;
  const activeAgeBand: AgeBandId = identity.userAgeBand || "11-20";
  const ageProfile = AGE_BAND_PROFILES[activeAgeBand] || AGE_BAND_PROFILES["11-20"];
  const activeMaturityMode = identity.maturityMode === "timeless" ? "timeless" : "maturing";
  const focusCalc = computeFocusWeights(
    activeAgeBand,
    identity.warmthHumor,
    identity.scholarlyDepth,
    activeMaturityMode
  );
  const isMaturing = activeMaturityMode === "maturing";
  const adaptiveEnabled = identity.adaptiveSelfTuning !== false;

  return (
    <div className="space-y-8">
      {/* Compact Core Anchor Locked Integrity Strip */}
      <div className="bg-surface border border-edge rounded-2xl px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-semibold text-ink">
              Core Anchor Locked · {ageProfile.primaryFocus}
            </div>
            <p className="text-[11px] text-ink-muted">
              Outer expression evolves; inner core never changes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {CORE_ANCHORS.map((anchor) => (
            <div
              key={anchor.id}
              title={anchor.detail}
              className="px-2.5 py-1 rounded-lg bg-surface-alt border border-edge text-[11px] font-medium text-ink whitespace-nowrap"
            >
              {anchor.title}
            </div>
          ))}
        </div>
      </div>

      {/* Universal + Industry-Gated Modules Grid */}
      <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Companion Modules
            </h2>
            <p className="text-xs text-ink-muted">
              Four universal modules are always available. Industry tools appear here only when enabled in Character Build.
            </p>
          </div>
          <span className="text-xs font-medium text-accent-ink">
            {selectedIndustry === "NONE"
              ? "Universal mode"
              : `${
                  selectedIndustry === "OTHER" && identity.otherIndustryName?.trim()
                    ? identity.otherIndustryName.trim()
                    : industrySpec.label
                } · ${enabledIndustryModules.length} enabled`}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {UNIVERSAL_MODULES.map((mod) => {
            const ModIcon = getUniversalModuleIcon(mod.id);
            const active = (identity.lifeFocus || "general") === mod.lifeFocus;
            return (
              <button
                key={mod.id}
                type="button"
                onClick={() => {
                  onUpdateIdentity({
                    ...identity,
                    lifeFocus: mod.lifeFocus,
                  });
                  onOpenTab?.(mod.targetTab);
                }}
                className={`group text-left p-3.5 rounded-xl border transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? "bg-accent-soft border-accent"
                    : "bg-surface-alt border-edge hover:border-edge-strong"
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink">
                      <ModIcon className="w-4 h-4 text-accent-ink shrink-0" />
                      {mod.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-ink-muted group-hover:text-accent-ink transition-colors shrink-0" />
                  </div>
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
                <div className="text-[10px] font-medium text-accent-ink">
                  {active ? "Active focus · Open" : "Open module"}
                </div>
              </button>
            );
          })}
        </div>

        {enabledIndustryModules.length > 0 && (
          <div className="pt-3 border-t border-edge space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                <IndustryIcon className="w-3.5 h-3.5 text-accent-ink" />
                <span>
                  Enabled from{" "}
                  {selectedIndustry === "OTHER" && identity.otherIndustryName?.trim()
                    ? identity.otherIndustryName.trim()
                    : industrySpec.label}
                </span>
              </div>
              {onOpenTab && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenTab("homework", enabledIndustryModules[0]?.id)
                  }
                  className="text-xs font-medium text-accent-ink hover:underline cursor-pointer"
                >
                  Open {industrySpec.shortDeskLabel}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {enabledIndustryModules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => onOpenTab?.("homework", mod.id)}
                  className="group text-left p-3 rounded-xl border border-edge-strong bg-accent-soft hover:border-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {mod.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-accent-ink shrink-0" />
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                    {mod.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {previewOnlyIndustryModules.length > 0 && (
          <div className="pt-3 border-t border-dashed border-edge-strong space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                <Eye className="w-3.5 h-3.5 text-accent-ink" />
                <span>
                  Preview · Optional {industrySpec.label} modules (not enabled yet)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewIndustryTiles(false)}
                className="text-[11px] text-ink-muted hover:text-ink cursor-pointer"
              >
                Close preview
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {previewOnlyIndustryModules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() =>
                    onUpdateIdentity({
                      ...identity,
                      enabledIndustryModules: [...enabledModuleIds, mod.id],
                    })
                  }
                  className="text-left p-3 rounded-xl border border-dashed border-edge-strong bg-surface-alt hover:border-accent transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {mod.label}
                    </span>
                    <span className="text-[10px] font-medium text-accent-ink">
                      + Enable
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-1 leading-snug">
                    {mod.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Interactive Stage */}
        <div className="lg:col-span-7 space-y-6">
          <PersonaSwitcher
            identity={identity}
            onSelectPersona={(nextTag, recGesture) => {
              onUpdateIdentity({ ...identity, activeNickname: nextTag });
              setGesture(recGesture);
            }}
          />

          <CompanionStageAvatar
            identity={identity}
            gesture={gesture}
            speechText={stageSpeech}
            viewMode={viewMode}
            framing={identity.cameraFraming || "half_body"}
            onChangeFraming={(cameraFraming) =>
              onUpdateIdentity({ ...identity, cameraFraming })
            }
            isSpeaking={isSpeaking}
            speechEnergy={speechEnergy}
            speechViseme={speechViseme}
            rigConfig={rigConfig}
            onToggleViewMode={setViewMode}
            onOpenShareModal={onOpenShareModal}
          />

          {gentleNudge && (
            <div className="bg-surface border border-accent/35 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs text-ink leading-relaxed">
                  {APP_COPY.gentleNudge[gentleNudge.variant].text}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={gentleNudge.onCustomize}
                    className="px-3 py-1 text-xs font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-hover cursor-pointer"
                  >
                    {APP_COPY.gentleNudge[gentleNudge.variant].primary}
                  </button>
                  <button
                    type="button"
                    onClick={gentleNudge.onDismiss}
                    className="px-2.5 py-1 text-xs text-ink-muted hover:text-ink cursor-pointer"
                  >
                    {APP_COPY.gentleNudge.dismiss}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Gesture, Lip-Sync & Lifelike Motion Deck */}
          <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Lifelike Facial Rig &amp; Lip-Sync Test
                </h3>
                <p className="text-xs text-ink-muted">
                  Trigger 8 facial rig states, drive phoneme lip-sync, and toggle natural blinking &amp; breathing.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Voice tone"
                  value={identity.voiceTone}
                  onChange={(e) =>
                    onUpdateIdentity({
                      ...identity,
                      voiceTone: e.target.value as VoiceTone,
                    })
                  }
                  className="px-3 py-1.5 text-xs font-medium bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <option value="warm">Warm Tone</option>
                  <option value="witty">Witty Tone</option>
                  <option value="calm">Calm Tone</option>
                  <option value="excited">Excited Tone</option>
                </select>
                <button
                  type="button"
                  disabled={identity.voiceSource === "silent"}
                  onClick={handleSpeakStage}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {identity.voiceSource === "silent"
                    ? "Silent Mode"
                    : isSpeaking
                    ? "Speaking..."
                    : "Speak & Lip-Sync"}
                </button>
              </div>
            </div>

            {/* 8 Expression State Triggers */}
            <div className="flex flex-wrap gap-2">
              {(Object.keys(GESTURE_LABELS) as GestureId[]).map((gKey) => (
                <button
                  key={gKey}
                  type="button"
                  onClick={() => setGesture(gKey)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    gesture === gKey
                      ? "bg-accent text-accent-fg border-accent"
                      : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                  }`}
                >
                  {GESTURE_LABELS[gKey].label}
                </button>
              ))}
            </div>

            {/* Autonomous Rig Motion Toggles + Live Rig State Line */}
            <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { key: "autoBlink", label: "Auto-Blink" },
                    { key: "breathing", label: "Breathing" },
                    { key: "lipSync", label: "Lip-Sync" },
                    { key: "gazeTracking", label: "Eye Gaze" },
                  ] as const
                ).map((item) => {
                  const enabled = rigConfig[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        setRigConfig((prev) => ({
                          ...prev,
                          [item.key]: !prev[item.key],
                        }))
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                        enabled
                          ? "bg-accent-soft text-accent-ink border-edge-strong"
                          : "bg-surface text-ink-muted border-edge"
                      }`}
                    >
                      {item.label}: {enabled ? "On" : "Off"}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs text-ink-muted font-mono-tabular">
                {activeRigSpec.muscleGroup} · Viseme: {isSpeaking ? speechViseme : "closed"} · Jaw {Math.round((isSpeaking ? Math.max(activeRigSpec.jawDrop, speechEnergy) : activeRigSpec.jawDrop) * 100)}%
              </div>
            </div>
          </div>

          {/* Lifespan Evolution Previewer */}
          <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  Lifespan Evolution Previewer
                </h3>
                <p className="text-xs text-ink-muted">
                  Preview how {identity.primaryName} evolves across decades while keeping {pronouns.possessive} incorruptible core.
                </p>
              </div>
              <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateIdentity({ ...identity, maturityMode: "maturing" })
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    isMaturing
                      ? "bg-surface text-ink ring-1 ring-edge"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Maturing With You
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateIdentity({ ...identity, maturityMode: "timeless" })
                  }
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    !isMaturing
                      ? "bg-surface text-ink ring-1 ring-edge"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  Timeless
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DECADE_STAGES.map((stage) => {
                const active = identity.decadeStage === stage.index;
                return (
                  <button
                    key={stage.index}
                    type="button"
                    onClick={() => {
                      onUpdateIdentity({ ...identity, decadeStage: stage.index });
                      setGesture(stage.index >= 2 ? "warm_nod" : "smirk");
                    }}
                    className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                      active
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                    }`}
                  >
                    <div className="font-mono-tabular text-[11px] opacity-80">
                      {stage.eraLabel} · {stage.ageRange}
                    </div>
                    <div className="text-xs font-semibold mt-0.5 truncate">
                      {stage.title}
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-ink-muted">
              {isMaturing
                ? `${decadeSpec.eraLabel} (${decadeSpec.ageRange}): ${decadeSpec.visualNote}`
                : "Timeless mode keeps youth-era appearance fixed while preserving full decade wisdom and speech pacing."}
            </p>
          </div>

          {/* Live Adaptive Focus Balance & Safety Guardrails */}
          <FocusBalanceCard
            ageBand={activeAgeBand}
            warmthHumor={identity.warmthHumor}
            scholarlyDepth={identity.scholarlyDepth}
            companionName={identity.primaryName}
            maturityMode={activeMaturityMode}
          />

          {/* Contextual Avatar Craft & Build-Triggered Modules */}
          <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {arch.craftBoxTitle}
                </h3>
                <p className="text-xs text-ink-muted mt-1 leading-relaxed">
                  {arch.craftBoxSummary}
                </p>
              </div>
              <span className="text-xs font-medium text-accent-ink whitespace-nowrap">
                {arch.craftHighlightLabel}
              </span>
            </div>

            {showIndustryDesk && (
              <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-ink-secondary leading-relaxed max-w-md">
                  <span className="font-semibold text-ink">
                    {industrySpec.shortDeskLabel} Unlocked:
                  </span>{" "}
                  {identity.primaryName} has{" "}
                  {enabledIndustryModules.map((m) => m.label).join(", ")} ready in your{" "}
                  {selectedIndustry === "OTHER" && identity.otherIndustryName?.trim()
                    ? identity.otherIndustryName.trim()
                    : industrySpec.label}{" "}
                  workspace.
                </div>
                {onOpenTab && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenTab("homework", enabledIndustryModules[0]?.id)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open {industrySpec.shortDeskLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {!showIndustryDesk && identity.lifeFocus === "creative" && (
              <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-ink-secondary leading-relaxed max-w-md">
                  <span className="font-semibold text-ink">Storycraft Mode Active:</span>{" "}
                  Co-author branching chapters and illustrated scenes with {identity.primaryName}.
                </div>
                {onOpenTab && (
                  <button
                    type="button"
                    onClick={() => onOpenTab("journal")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Storytime
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {!showIndustryDesk && identity.lifeFocus === "wellness" && (
              <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-ink-secondary leading-relaxed max-w-md">
                  <span className="font-semibold text-ink">Mindfulness &amp; Reflections:</span>{" "}
                  Private journal check-ins and calm lock-screen phrases are prioritized for {identity.primaryName}.
                </div>
                {onOpenTab && (
                  <button
                    type="button"
                    onClick={() => onOpenTab("journal")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Journal
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {!showIndustryDesk && identity.lifeFocus === "family" && (
              <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-ink-secondary leading-relaxed max-w-md">
                  <span className="font-semibold text-ink">Family &amp; Youth-Safe Pacing:</span>{" "}
                  Age-tier boundaries and transparent session limits are ready in Guardian Controls.
                </div>
                {onOpenTab && (
                  <button
                    type="button"
                    onClick={() => onOpenTab("guardian")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Guardian Controls
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Control Deck */}
        <div className="lg:col-span-5 space-y-6">
          {/* 01. Character Build & Gender */}
          <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                01. Character Build &amp; Gender
              </h2>
              <p className="text-xs text-ink-muted mt-0.5">
                Shape who this companion is for—only relevant tools and boxes appear from this build.
              </p>
            </div>

            {/* Companion Gender Selector */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-ink-secondary">
                Companion Gender &amp; Voice Presence
              </div>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((opt) => {
                  const selected = gender === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSelectGender(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{opt.label}</div>
                      <div className="text-[11px] opacity-80">{opt.pronouns}</div>
                    </button>
                  );
                })}
              </div>

              {/* Voice Pitch / Tuning Slider */}
              <div className="space-y-1.5 p-3 rounded-xl bg-surface-alt border border-edge">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">
                    Voice Pitch / Tuning
                  </span>
                  <span className="font-mono-tabular text-[11px] text-accent-ink font-semibold">
                    {((identity.voicePitch ?? (gender === "feminine" ? 1.15 : gender === "nonbinary" ? 1.0 : 0.9))).toFixed(2)}x ·{" "}
                    {(identity.voicePitch ?? (gender === "feminine" ? 1.15 : gender === "nonbinary" ? 1.0 : 0.9)) <= 0.85
                      ? "Deep / Grounded"
                      : (identity.voicePitch ?? (gender === "feminine" ? 1.15 : gender === "nonbinary" ? 1.0 : 0.9)) >= 1.15
                      ? "Bright / High"
                      : "Balanced"}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="1.4"
                  step="0.05"
                  aria-label="Voice pitch tuning slider"
                  value={identity.voicePitch ?? (gender === "feminine" ? 1.15 : gender === "nonbinary" ? 1.0 : 0.9)}
                  onChange={(e) =>
                    onUpdateIdentity({
                      ...identity,
                      voicePitch: Number(e.target.value),
                    })
                  }
                  className="w-full accent-accent cursor-pointer"
                />
                <div className="flex items-center justify-between text-[11px] text-ink-muted">
                  <span>0.6x (Deep)</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onUpdateIdentity({ ...identity, voicePitch: 0.8 })}
                      className="px-1.5 py-0.5 rounded bg-surface border border-edge hover:border-accent text-[10px] text-ink cursor-pointer"
                    >
                      Deep (0.8x)
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateIdentity({ ...identity, voicePitch: 1.0 })}
                      className="px-1.5 py-0.5 rounded bg-surface border border-edge hover:border-accent text-[10px] text-ink cursor-pointer"
                    >
                      Natural (1.0x)
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateIdentity({ ...identity, voicePitch: 1.2 })}
                      className="px-1.5 py-0.5 rounded bg-surface border border-edge hover:border-accent text-[10px] text-ink cursor-pointer"
                    >
                      Bright (1.2x)
                    </button>
                  </div>
                  <span>1.4x (High)</span>
                </div>
              </div>
            </div>

            {/* 7-Band All-Ages Primary Focus Calibration */}
            <div className="space-y-2.5 pt-2 border-t border-edge">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-secondary">
                  Age Band &amp; Primary Life Focus
                </span>
                <span className="text-[11px] font-medium text-accent-ink">
                  {ageProfile.primaryFocus}
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {AGE_BAND_ORDER.map((bandId) => {
                  const selected = activeAgeBand === bandId;
                  const band = AGE_BAND_PROFILES[bandId];
                  return (
                    <button
                      key={bandId}
                      type="button"
                      onClick={() => {
                        onUpdateIdentity({ ...identity, userAgeBand: bandId });
                        setGesture(band.recommendedGesture);
                      }}
                      className={`py-2 px-1.5 rounded-lg border text-center transition-colors cursor-pointer ${
                        selected
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                      }`}
                    >
                      <div className="font-mono-tabular text-xs font-semibold">
                        {band.shortLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="p-3 rounded-xl bg-surface-alt border border-edge space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-ink">
                    {ageProfile.primaryFocus}
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    Secondary: {ageProfile.secondaryFocus}
                  </span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  {ageProfile.embodiment}
                </p>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {ageProfile.focusAreas.map((area) => (
                    <span
                      key={area}
                      className="px-2 py-0.5 text-[10px] font-medium rounded bg-surface border border-edge text-ink-secondary"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Intended Life Focus Selector */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-ink-secondary">
                Active Companion Module Focus
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {LIFE_FOCUS_OPTIONS.map((opt) => {
                  const active = (identity.lifeFocus || "general") === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdateIdentity({
                          ...identity,
                          lifeFocus: opt.id,
                        })
                      }
                      className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? "bg-accent-soft border-accent text-ink"
                          : "bg-surface-alt border-edge text-ink-secondary hover:border-edge-strong"
                      }`}
                    >
                      <div className="text-xs font-semibold">{opt.label}</div>
                      <div className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">
                        {opt.shortDesc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Industry Context (Optional — Industry-Gated Modules) */}
            <div className="space-y-3 pt-2 border-t border-edge">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="industry-context-select"
                  className="text-xs font-medium text-ink-secondary"
                >
                  Industry Context (Optional)
                </label>
                <span className="text-[11px] font-medium text-accent-ink">
                  {selectedIndustry === "NONE"
                    ? "Universal only"
                    : `${enabledIndustryModules.length} enabled`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent-soft border border-edge flex items-center justify-center shrink-0">
                  <IndustryIcon className="w-4 h-4 text-accent-ink" />
                </div>
                <select
                  id="industry-context-select"
                  value={selectedIndustry}
                  onChange={(e) => {
                    const nextIndustry = e.target.value as IndustryId;
                    setPreviewIndustryTiles(false);
                    onUpdateIdentity({
                      ...identity,
                      selectedIndustry: nextIndustry,
                      enabledIndustryModules: [],
                      otherIndustryName:
                        nextIndustry === "OTHER" ? identity.otherIndustryName || "" : "",
                      lifeFocus:
                        nextIndustry !== "SCHOOL" && identity.lifeFocus === "student"
                          ? "general"
                          : identity.lifeFocus,
                    });
                  }}
                  className="flex-1 min-w-0 px-3 py-2 text-xs font-medium bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {INDUSTRY_ORDER.map((indId) => (
                    <option key={indId} value={indId}>
                      {INDUSTRIES[indId].label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-[11px] text-ink-muted">
                {selectedIndustry === "NONE"
                  ? "No industry needed — your four universal modules cover everything."
                  : industrySpec.tagline}
              </p>

              {selectedIndustry === "OTHER" && (
                <input
                  type="text"
                  maxLength={100}
                  value={identity.otherIndustryName || ""}
                  onChange={(e) =>
                    onUpdateIdentity({
                      ...identity,
                      otherIndustryName: e.target.value,
                    })
                  }
                  placeholder="Describe your field (e.g. Architecture, Law, Logistics)..."
                  className="w-full px-3 py-2 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
              )}

              {industrySpec.modules.length > 0 && (
                <div className="p-3 rounded-xl bg-surface-alt border border-edge space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-ink">
                      Optional {industrySpec.label} Modules
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewIndustryTiles((prev) => !prev)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors cursor-pointer ${
                        previewIndustryTiles
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface text-accent-ink border-edge-strong hover:border-accent"
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      {previewIndustryTiles ? "Hide preview" : "Preview how this looks"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {industrySpec.modules.map((mod) => {
                      const enabled = enabledModuleIds.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            const nextModules = enabled
                              ? enabledModuleIds.filter((id) => id !== mod.id)
                              : [...enabledModuleIds, mod.id];
                            onUpdateIdentity({
                              ...identity,
                              enabledIndustryModules: nextModules,
                            });
                          }}
                          className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                            enabled
                              ? "bg-accent-soft border-accent text-ink"
                              : "bg-surface border-edge text-ink-secondary hover:border-edge-strong"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-semibold">{mod.label}</span>
                            {enabled && (
                              <Check className="w-3.5 h-3.5 text-accent-ink shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-0.5 leading-snug">
                            {mod.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Character Build Note */}
            <div className="space-y-1.5 pt-2 border-t border-edge">
              <label
                htmlFor="character-build-note"
                className="block text-xs font-medium text-ink-secondary"
              >
                Character Build Brief (Optional)
              </label>
              <textarea
                id="character-build-note"
                rows={2}
                maxLength={240}
                value={identity.characterBuildNote || ""}
                onChange={(e) =>
                  onUpdateIdentity({
                    ...identity,
                    characterBuildNote: e.target.value,
                  })
                }
                placeholder="Describe who this companion is for, their personality, interests, and preferred pace..."
                className="w-full px-3 py-2 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </section>

          {/* 02. Name & Nickname Generator / Selector */}
          <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  02. Name &amp; Nickname Selector
                </h2>
                <p className="text-xs text-ink-muted mt-0.5">
                  Custom naming, gender-matched suggestions, self-naming, and shorthand tags.
                </p>
              </div>
            </div>

            {/* Primary Name + Suggest for Archetype */}
            <div className="space-y-2">
              <label
                htmlFor="primary-name-input"
                className="block text-xs font-medium text-ink-secondary"
              >
                Primary Name
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="primary-name-input"
                  type="text"
                  maxLength={48}
                  value={identity.primaryName}
                  disabled={identity.letHimChoose}
                  onChange={(e) =>
                    onUpdateIdentity({
                      ...identity,
                      primaryName: e.target.value,
                      letHimChoose: false,
                    })
                  }
                  placeholder="Enter a name..."
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleSuggestName}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Suggest for Archetype
                </button>
              </div>
              <div className="text-xs text-ink-muted">
                Curated for {arch.shortLabel} ({pronouns.label}): {genderCuratedNames.join(" · ")}
              </div>
            </div>

            {/* Self-Selection Toggle */}
            <div className="flex items-center justify-between gap-4 py-3 border-y border-edge">
              <div>
                <div className="text-sm font-medium text-ink">
                  Let {pronouns.titleObject} Choose
                </div>
                <div className="text-xs text-ink-muted">
                  {pronouns.titleSubject} automatically selects a signature name matching the active archetype.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={identity.letHimChoose}
                onClick={handleToggleLetHimChoose}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  identity.letHimChoose ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    identity.letHimChoose ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Shorthand Nickname Tag Manager */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="nickname-add-input"
                  className="text-xs font-medium text-ink-secondary"
                >
                  Shorthand Nickname Tags ({identity.nicknames.length}/10)
                </label>
                {identity.activeNickname && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateIdentity({ ...identity, activeNickname: "" })
                    }
                    className="text-xs text-ink-muted hover:text-ink cursor-pointer"
                  >
                    Clear active
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="nickname-add-input"
                  type="text"
                  maxLength={32}
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNickname();
                    }
                  }}
                  placeholder="Add nickname (e.g. Jules, Boss, Star)"
                  className="flex-1 min-w-0 px-3 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  onClick={handleAddNickname}
                  disabled={!newNickname.trim() || identity.nicknames.length >= 10}
                  className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {identity.nicknames.map((tag) => {
                  const isActive = identity.activeNickname === tag;
                  return (
                    <div
                      key={tag}
                      className={`inline-flex items-center rounded-md border text-xs font-medium transition-colors ${
                        isActive
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface-alt text-ink-secondary border-edge"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateIdentity({
                            ...identity,
                            activeNickname: isActive ? "" : tag,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 cursor-pointer whitespace-nowrap"
                      >
                        {isActive && <Check className="w-3 h-3" />}
                        <span>{tag}</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove nickname ${tag}`}
                        onClick={() => handleRemoveNickname(tag)}
                        className={`pr-2 pl-1 py-1.5 cursor-pointer ${
                          isActive
                            ? "text-white/80 hover:text-white"
                            : "text-ink-muted hover:text-ink"
                        }`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 03. Archetype Templates */}
          <section
            id="archetype-selector"
            onMouseEnter={() => onBrowseArchetypes?.()}
            className="bg-surface border border-edge rounded-2xl p-5 space-y-3 transition-shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink">
                03. Archetype Templates
              </h2>
              <button
                type="button"
                onClick={() => setShowArchetypePalette((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showArchetypePalette
                    ? "bg-accent text-accent-fg border-accent"
                    : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong hover:text-ink"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                {showArchetypePalette ? "Hide Palette" : "View Palette"}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((key) => {
                const item = ARCHETYPES[key];
                const selected = identity.archetype === key;
                const previewNames =
                  item.curatedNamesByGender?.[gender] || item.curatedNames;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectArchetype(key)}
                    className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? "bg-accent-soft border-accent"
                        : "bg-surface-alt border-edge hover:border-edge-strong"
                    }`}
                  >
                    <img
                      src={item.portraitUrl}
                      alt={item.label}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-lg object-cover shrink-0 bg-[#090D16] border border-edge"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink truncate">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-ink-muted line-clamp-1">
                        {previewNames.slice(0, 3).join(", ")}
                      </div>
                      <PaletteSwatchInline archetypeId={key} />
                    </div>
                  </button>
                );
              })}
            </div>
            {showArchetypePalette && <PaletteSwatch archetypeId={identity.archetype} />}
          </section>

          {/* 04. Appearance & Temperament Sliders */}
          <section className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-ink">
              04. Fine-Tune Appearance &amp; Temperament
            </h2>
            <div className="space-y-3.5">
              {(
                [
                  { key: "coatLayering", label: "Coat & Layering", unit: "%" },
                  { key: "hairLength", label: "Hair Length & Texture", unit: "%" },
                  { key: "accessoryDetail", label: "Eyewear & Accessories", unit: "%" },
                  { key: "warmthHumor", label: "Warmth & Humor", unit: "%" },
                  {
                    key: "scholarlyDepth",
                    label: showStudyLab
                      ? "Study & Homework Depth"
                      : "Literary & Conversational Depth",
                    unit: "%",
                  },
                ] as const
              ).map((slider) => (
                <div key={slider.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor={`slider-${slider.key}`} className="font-medium text-ink-secondary">
                      {slider.label}
                    </label>
                    <span className="font-mono-tabular text-ink font-medium">
                      {identity[slider.key]}
                      {slider.unit}
                    </span>
                  </div>
                  <input
                    id={`slider-${slider.key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={identity[slider.key]}
                    onChange={(e) =>
                      onUpdateIdentity({
                        ...identity,
                        [slider.key]: Number(e.target.value),
                      })
                    }
                    className="w-full kith-slider"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* 05. Photo or Style Self-Tuning */}
          <section className="bg-surface border border-edge rounded-2xl p-5 space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  05. Adaptive Self-Tuning
                </h2>
                <p className="text-xs text-ink-muted">
                  Upload a reference photo or describe a mood, outfit, or voice—{pronouns.subject} adapts while keeping {pronouns.possessive} incorruptible core.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={adaptiveEnabled}
                aria-label="Toggle adaptive self-tuning"
                onClick={() =>
                  onUpdateIdentity({
                    ...identity,
                    adaptiveSelfTuning: !adaptiveEnabled,
                  })
                }
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  adaptiveEnabled ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    adaptiveEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <textarea
              rows={2}
              value={tuneDescription}
              onChange={(e) => setTuneDescription(e.target.value)}
              placeholder="e.g., Rainy autumn bookstore vibe, sharp wit, comforting tone..."
              className="w-full px-3 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-ink-secondary bg-surface-alt border border-edge rounded-lg hover:border-edge-strong cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>{tuneAttachment ? tuneAttachment.fileName : "Upload Photo"}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                disabled={tuningBusy || offlineMode || (!tuneDescription.trim() && !tuneAttachment)}
                onClick={handleRunSelfTune}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {tuningBusy ? "Tuning..." : `Let ${pronouns.titleObject} Adapt`}
              </button>
            </div>

            {tuningMessage && (
              <div className="p-3 rounded-lg bg-accent-soft border border-edge text-xs text-ink leading-relaxed">
                {tuningMessage}
              </div>
            )}
            {tuningError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
                {tuningError}
              </div>
            )}

            {/* Compact Active Calibration Summary */}
            <div className="pt-3 border-t border-edge grid grid-cols-2 gap-2 text-[11px] text-ink-muted">
              <div className="p-2 rounded-lg bg-surface-alt">
                <span className="font-semibold text-ink">Focus Split:</span>{" "}
                {focusCalc.weights.trust}/{focusCalc.weights.intellect}/{focusCalc.weights.attunement}/{focusCalc.weights.personality}
              </div>
              <div className="p-2 rounded-lg bg-surface-alt">
                <span className="font-semibold text-ink">Pacing:</span>{" "}
                {adaptiveEnabled ? "Adaptive Mirroring" : "Locked Cadence"}
              </div>
            </div>

            {learnedPreferences && (
              <div className="pt-3 border-t border-edge space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    What {identity.primaryName} Learned About You
                  </span>
                  {(learnedPreferences.likedNotes.length > 0 ||
                    learnedPreferences.dislikedNotes.length > 0 ||
                    learnedPreferences.upCount > 0 ||
                    learnedPreferences.downCount > 0) &&
                    onClearLearnedPreferences && (
                      <button
                        type="button"
                        onClick={onClearLearnedPreferences}
                        className="text-[11px] text-ink-muted hover:text-ink cursor-pointer"
                      >
                        Reset learned hints
                      </button>
                    )}
                </div>
                <div className="text-[11px] text-ink-muted flex flex-wrap items-center gap-3 font-mono-tabular">
                  <span>{chatMessageCount} saved chat turns</span>
                  <span>·</span>
                  <span>{learnedPreferences.upCount} liked replies</span>
                  <span>·</span>
                  <span>{learnedPreferences.downCount} tone adjustments</span>
                </div>
                {learnedPreferences.likedNotes.length === 0 &&
                learnedPreferences.dislikedNotes.length === 0 ? (
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    Rate replies with thumbs up/down in Live Companion so {identity.primaryName} remembers the tone and pacing that work best for you.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {learnedPreferences.likedNotes.slice(0, 3).map((note, idx) => (
                      <div
                        key={`like-${idx}`}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-alt border border-edge text-[11px] text-ink-secondary"
                      >
                        <span className="font-semibold text-accent-ink">Appreciated:</span>{" "}
                        {note}
                      </div>
                    ))}
                    {learnedPreferences.dislikedNotes.slice(0, 2).map((note, idx) => (
                      <div
                        key={`dislike-${idx}`}
                        className="px-2.5 py-1.5 rounded-lg bg-surface-alt border border-edge text-[11px] text-ink-secondary"
                      >
                        <span className="font-semibold text-ink">Avoiding:</span>{" "}
                        {note}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* 06 & 07. Avatar Surroundings Generator + Optional Voice Studio */}
          <SurroundingsAndVoicePanel
            identity={identity}
            userId={userId}
            offlineMode={offlineMode}
            onUpdateIdentity={onUpdateIdentity}
            onLogActivity={onLogActivity}
            onSpeechPreviewStart={() => setIsSpeaking(true)}
            onSpeechPreviewEnd={() => {
              setIsSpeaking(false);
              setSpeechEnergy(0);
              setSpeechViseme("closed");
            }}
            onSpeechPreviewFrame={(frame) => {
              setSpeechEnergy(frame.energy);
              setSpeechViseme(frame.viseme);
            }}
          />

          <PortraitMode
            identity={identity}
            onOpenShareModal={onOpenShareModal}
            onLogActivity={onLogActivity}
          />
        </div>
      </div>

      {/* Stylized vs. Photorealistic 3D & Facial Rig Architecture Panel */}
      <AvatarArchitecturePanel
        identity={identity}
        activeGesture={gesture}
        activeViewMode={viewMode}
        onSelectGesture={setGesture}
        onSelectViewMode={setViewMode}
      />
    </div>
  );
}
