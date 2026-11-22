export type ArchetypeId =
  | "goth_academia"
  | "classic_scholar"
  | "sporty_vanguard"
  | "arcane_fantasy"
  | "retro_analog";

export type GestureId =
  | "smirk"
  | "wink"
  | "laugh"
  | "thumbs_up"
  | "concerned_tilt"
  | "warm_nod"
  | "curious_brow"
  | "gentle_smile";

export type VisemeId = "closed" | "aa" | "ee" | "oh" | "mm";

export interface RigMotionConfig {
  autoBlink: boolean;
  breathing: boolean;
  lipSync: boolean;
  gazeTracking: boolean;
}

export const DEFAULT_RIG_MOTION_CONFIG: RigMotionConfig = {
  autoBlink: true,
  breathing: true,
  lipSync: true,
  gazeTracking: true,
};

export interface FacialRigStateSpec {
  id: GestureId;
  label: string;
  cue: string;
  muscleGroup: string;
  jawDrop: number; // 0..1
  smileCurve: number; // -1..1
  asymSmirk: number; // 0..1
  browLiftL: number; // -1..1
  browLiftR: number; // -1..1
  eyeSquintL: number; // 0..1
  eyeSquintR: number; // 0..1
  headTiltDeg: number;
  headPitchDeg: number;
}

export type VoiceTone = "warm" | "excited" | "calm" | "witty";

export type VoiceSourceId =
  | "suggested"
  | "preset_cast"
  | "recorded_media"
  | "live_mic"
  | "own_voice"
  | "silent";

export type AvatarFraming = "headshot" | "half_body" | "full_body";

export const AVATAR_FRAMING_OPTIONS: {
  id: AvatarFraming;
  label: string;
  shortDesc: string;
}[] = [
  { id: "headshot", label: "Headshot", shortDesc: "Close portrait & expressions" },
  { id: "half_body", label: "Half Body", shortDesc: "Waist-up studio framing" },
  { id: "full_body", label: "Full Body", shortDesc: "Head-to-toe with full setting" },
];

export type BackgroundPresetId =
  | "studio_plinth"
  | "library_study"
  | "rainy_bookshop"
  | "observatory"
  | "vinyl_lounge"
  | "coastal_dusk"
  | "city_skyline"
  | "river_boat"
  | "emerald_jungle"
  | "desert_pyramid"
  | "mars_planet"
  | "custom";

export type BackgroundPropTheme =
  | "minimal"
  | "library"
  | "rainy_cafe"
  | "observatory"
  | "music_lounge"
  | "outdoor_coast"
  | "city"
  | "river_boat"
  | "jungle"
  | "pyramid"
  | "mars";

export type BackgroundAmbientMotif =
  | "none"
  | "motes"
  | "rain"
  | "stars"
  | "fireflies";

export interface BackgroundSpec {
  title: string;
  description: string;
  skyTopHex: string;
  skyBottomHex: string;
  fogHex: string;
  keyLightHex: string;
  rimLightHex: string;
  propTheme: BackgroundPropTheme;
  ambientMotif: BackgroundAmbientMotif;
}

export type CompanionGender = "masculine" | "feminine" | "nonbinary";

export type LifeFocusId =
  | "general"
  | "growth"
  | "creative"
  | "wellness"
  | "family"
  | "student";

export type IndustryId =
  | "NONE"
  | "SCHOOL"
  | "MEDICAL"
  | "TECH"
  | "CREATIVE"
  | "BUSINESS"
  | "TRADES"
  | "OTHER";

export interface IndustryModuleSpec {
  id: string;
  label: string;
  desc: string;
}

export interface IndustrySpec {
  id: IndustryId;
  label: string;
  shortDeskLabel: string;
  tagline: string;
  modules: IndustryModuleSpec[];
}

export const UNIVERSAL_MODULES: {
  id: "everyday" | "creative" | "mindfulness" | "growth";
  label: string;
  desc: string;
  targetTab: StudioTab;
  lifeFocus: LifeFocusId;
}[] = [
  {
    id: "everyday",
    label: "Everyday Ally",
    desc: "Warm conversation, daily clarity, and honest problem-solving.",
    targetTab: "companion",
    lifeFocus: "general",
  },
  {
    id: "creative",
    label: "Creative Ally",
    desc: "Storycraft, worldbuilding, writing sparks, and visual scenes.",
    targetTab: "journal",
    lifeFocus: "creative",
  },
  {
    id: "mindfulness",
    label: "Mindfulness",
    desc: "Grounding check-ins, calm reflections, and mood lock-screen notes.",
    targetTab: "journal",
    lifeFocus: "wellness",
  },
  {
    id: "growth",
    label: "Growth & Skills",
    desc: "Habit momentum, critical thinking, and personal milestones.",
    targetTab: "companion",
    lifeFocus: "growth",
  },
];

export const INDUSTRIES: Record<IndustryId, IndustrySpec> = {
  NONE: {
    id: "NONE",
    label: "Not in an industry / Prefer not to say",
    shortDeskLabel: "Companion",
    tagline: "You are fully covered — the four universal modules have everything you need.",
    modules: [],
  },
  SCHOOL: {
    id: "SCHOOL",
    label: "School / Student",
    shortDeskLabel: "Study Lab",
    tagline: "Homework, essays, exam prep, and study strategy.",
    modules: [
      { id: "homework", label: "Homework Helper", desc: "Break down assignments step by step" },
      { id: "essays", label: "Essays & Writing", desc: "Structure, arguments, and polish" },
      { id: "exams", label: "Exam Prep", desc: "Study plans, practice, recall drills" },
      { id: "studyplan", label: "Study Strategy", desc: "Time blocking and focus routines" },
    ],
  },
  MEDICAL: {
    id: "MEDICAL",
    label: "Medical / Healthcare",
    shortDeskLabel: "Clinical Desk",
    tagline: "Shift reminders, clinical references, patient-comms drafting.",
    modules: [
      { id: "reminders", label: "Shift & Task Reminders", desc: "Handoffs, rounds, follow-ups" },
      { id: "clinical", label: "Clinical Quick Reference", desc: "Checklists, protocols, terminology" },
      { id: "comms", label: "Patient Communication", desc: "Draft clear, kind explanations" },
    ],
  },
  TECH: {
    id: "TECH",
    label: "Tech / Engineering",
    shortDeskLabel: "Engineering Desk",
    tagline: "Code reviews, debugging, system design.",
    modules: [
      { id: "debug", label: "Debug Companion", desc: "Trace, isolate, and fix issues" },
      { id: "design", label: "System Design", desc: "Architecture and trade-offs" },
      { id: "review", label: "Code Review", desc: "Readable, safe, idiomatic feedback" },
    ],
  },
  CREATIVE: {
    id: "CREATIVE",
    label: "Creative / Media",
    shortDeskLabel: "Studio Desk",
    tagline: "Drafting, editing, ideation, storytelling.",
    modules: [
      { id: "draft", label: "Draft Studio", desc: "Scripts, copy, concepts" },
      { id: "edit", label: "Edit & Polish", desc: "Tighten, sharpen, restructure" },
      { id: "ideate", label: "Idea Generator", desc: "Angles, hooks, concepts" },
    ],
  },
  BUSINESS: {
    id: "BUSINESS",
    label: "Business / Finance",
    shortDeskLabel: "Strategy Desk",
    tagline: "Strategy, memos, negotiation, planning.",
    modules: [
      { id: "strategy", label: "Strategy Sparring", desc: "Frame and pressure-test decisions" },
      { id: "memos", label: "Memos & Reports", desc: "Concise, decision-ready writing" },
      { id: "negotiate", label: "Negotiation Prep", desc: "Positioning and counter-scenarios" },
    ],
  },
  TRADES: {
    id: "TRADES",
    label: "Skilled Trades / Field Work",
    shortDeskLabel: "Field Desk",
    tagline: "Job-site planning, safety checks, task tracking.",
    modules: [
      { id: "jobplan", label: "Job Planning", desc: "Sequence, materials, timing" },
      { id: "safety", label: "Safety Checklists", desc: "Pre-task and shutdown checks" },
      { id: "track", label: "Task Tracker", desc: "Daily progress and blockers" },
    ],
  },
  OTHER: {
    id: "OTHER",
    label: "Other industry",
    shortDeskLabel: "Custom Desk",
    tagline: "Tell me your field — I will shape tailored modules for it.",
    modules: [
      { id: "custom", label: "Custom Module", desc: "Describe what you do and I will shape it" },
    ],
  },
};

export const INDUSTRY_ORDER: IndustryId[] = [
  "NONE",
  "SCHOOL",
  "MEDICAL",
  "TECH",
  "CREATIVE",
  "BUSINESS",
  "TRADES",
  "OTHER",
];

export type AgeTier = "all_ages" | "teen" | "adult";

export type AppTheme = "dark" | "dim" | "light";

export type StudioTab =
  | "identity"
  | "companion"
  | "homework"
  | "journal"
  | "guardian";

export type MusicGenreId =
  | "classic"
  | "pop"
  | "rap"
  | "country"
  | "electronic"
  | "instrumental";

export type MusicPresetId = "none" | MusicGenreId | "custom";

export type MusicScaleMode =
  | "major"
  | "minor"
  | "dorian"
  | "pentatonic_major"
  | "pentatonic_minor";

export type MusicLeadInstrument =
  | "piano"
  | "strings"
  | "acoustic_guitar"
  | "synth_pluck"
  | "warm_pad"
  | "flute";

export type MusicBassStyle =
  | "none"
  | "cello_drone"
  | "sub_808"
  | "synth_pulse"
  | "country_root_fifth"
  | "walking_bass";

export type MusicDrumPattern =
  | "none"
  | "boom_bap"
  | "pop_groove"
  | "country_brush"
  | "electronic_pulse"
  | "soft_ambient";

export interface MusicSpec {
  title: string;
  description: string;
  genre: MusicGenreId;
  bpm: number;
  rootMidi: number;
  scaleMode: MusicScaleMode;
  chords: number[];
  melody: number[];
  leadInstrument: MusicLeadInstrument;
  bassStyle: MusicBassStyle;
  drumPattern: MusicDrumPattern;
  brightness: number;
  swing: number;
}

export type AgeBandId = "0-10" | "11-20" | "21-30" | "31-40" | "41-50" | "51-60" | "61+";

export type MaturityMode = "timeless" | "maturing";

export type FocusDimensionKey = "trust" | "intellect" | "attunement" | "personality";

export type FocusWeights = Record<FocusDimensionKey, number>;

export interface FocusClampInfo {
  key: FocusDimensionKey;
  raw: number;
  clamped: number;
  boundType: "floor" | "ceiling";
  limit: number;
  reason: string;
}

export interface AgeBandProfile {
  id: AgeBandId;
  label: string;
  shortLabel: string;
  primaryFocus: string;
  secondaryFocus: string;
  embodiment: string;
  recommendedGesture: GestureId;
  focusAreas: string[];
  targetWeights: FocusWeights;
  leaningNote: string;
}

export const CORE_ANCHORS: {
  id: string;
  title: string;
  detail: string;
}[] = [
  {
    id: "loyalty",
    title: "Incorruptible Loyalty",
    detail: "Always on your side, never judgmental",
  },
  {
    id: "intellect",
    title: "Brilliant Intellect",
    detail: "Sharp across literature, logic, and life problems",
  },
  {
    id: "positivity",
    title: "Positive Energy",
    detail: "Encouraging without being saccharine or dismissive",
  },
  {
    id: "adaptive",
    title: "Adaptive Presence",
    detail: "Matches your pace, tone, and maturity level",
  },
];

export const BASE_FOCUS_WEIGHTS: FocusWeights = {
  trust: 35,
  intellect: 30,
  attunement: 20,
  personality: 15,
};

export const AGE_BAND_PROFILES: Record<AgeBandId, AgeBandProfile> = {
  "0-10": {
    id: "0-10",
    label: "0–10 · Wonder & Safety",
    shortLabel: "0–10",
    primaryFocus: "Safety + Wonder",
    secondaryFocus: "Learning through play",
    embodiment: "Warm, encouraging, playful guide who makes learning feel like adventure.",
    recommendedGesture: "gentle_smile",
    focusAreas: ["Curiosity & Play", "Bedtime & Storycraft", "Gentle Confidence"],
    targetWeights: { trust: 45, intellect: 20, attunement: 25, personality: 10 },
    leaningNote: "Maximum safety & warm emotional grounding while keeping wonder effortless.",
  },
  "11-20": {
    id: "11-20",
    label: "11–20 · Identity & Confidence",
    shortLabel: "11–20",
    primaryFocus: "Identity + Academic Confidence",
    secondaryFocus: "Social navigation",
    embodiment: "Sharp, non-judgmental ally who decodes complexity and reduces pressure.",
    recommendedGesture: "smirk",
    focusAreas: ["Exam & Essay Clarity", "Zero-Judgment Advice", "Creative Voice"],
    targetWeights: { trust: 38, intellect: 27, attunement: 22, personality: 13 },
    leaningNote: "High trust paired with sharp academic clarity and authentic peer-level wit.",
  },
  "21-30": {
    id: "21-30",
    label: "21–30 · Momentum & Launch",
    shortLabel: "21–30",
    primaryFocus: "Momentum + Career Launch",
    secondaryFocus: "Independence & risk-taking",
    embodiment: "Honest, high-energy strategist who turns ideas into action.",
    recommendedGesture: "wink",
    focusAreas: ["Strategy & Trade-offs", "First-Principles Rigor", "Momentum Habits"],
    targetWeights: { trust: 28, intellect: 35, attunement: 17, personality: 20 },
    leaningNote: "Leans hardest into intellectual sharpness & bold strategic momentum.",
  },
  "31-40": {
    id: "31-40",
    label: "31–40 · Clarity & Balance",
    shortLabel: "31–40",
    primaryFocus: "Clarity + Balance",
    secondaryFocus: "Execution under pressure",
    embodiment: "Grounded, decisive partner who cuts through noise.",
    recommendedGesture: "warm_nod",
    focusAreas: ["Decision Hygiene", "Leadership Calm", "Time & Focus Synthesis"],
    targetWeights: { trust: 30, intellect: 34, attunement: 20, personality: 16 },
    leaningNote: "Balances decisive executive sharpness with calm, steady attunement.",
  },
  "41-50": {
    id: "41-50",
    label: "41–50 · Perspective & Reinvention",
    shortLabel: "41–50",
    primaryFocus: "Perspective + Reinvention",
    secondaryFocus: "Mentorship & synthesis",
    embodiment: "Thoughtful sparring partner who connects wisdom to fresh angles.",
    recommendedGesture: "curious_brow",
    focusAreas: ["Second-Act Design", "Systems Synthesis", "Mentorship Framing"],
    targetWeights: { trust: 32, intellect: 32, attunement: 21, personality: 15 },
    leaningNote: "Evenly anchors trust, analytical depth, and reflective life synthesis.",
  },
  "51-60": {
    id: "51-60",
    label: "51–60 · Meaning & Connection",
    shortLabel: "51–60",
    primaryFocus: "Meaning + Deep Connection",
    secondaryFocus: "Creative legacy",
    embodiment: "Unrushed, reflective companion for reinvention and reflection.",
    recommendedGesture: "warm_nod",
    focusAreas: ["Narrative & Memoir", "Deep Listening", "Unhurried Craft"],
    targetWeights: { trust: 36, intellect: 28, attunement: 24, personality: 12 },
    leaningNote: "Elevates reflective warmth and unhurried wisdom above surface banter.",
  },
  "61+": {
    id: "61+",
    label: "61+ · Legacy & Everyday Joy",
    shortLabel: "61+",
    primaryFocus: "Legacy + Everyday Joy",
    secondaryFocus: "Curiosity & companionship",
    embodiment: "Patient, warm presence for storytelling and daily problem-solving.",
    recommendedGesture: "laugh",
    focusAreas: ["Living Memory & Stories", "Patient Walkthroughs", "Everyday Companionship"],
    targetWeights: { trust: 42, intellect: 22, attunement: 26, personality: 10 },
    leaningNote: "Protects deep emotional attunement (≥ 24%) and steady, patient warmth.",
  },
};

export const AGE_BAND_ORDER: AgeBandId[] = [
  "0-10",
  "11-20",
  "21-30",
  "31-40",
  "41-50",
  "51-60",
  "61+",
];

export function computeFocusWeights(
  ageBand: AgeBandId = "11-20",
  warmthHumor = 80,
  scholarlyDepth = 85,
  maturityMode: MaturityMode = "maturing"
): {
  raw: FocusWeights;
  weights: FocusWeights;
  clamps: FocusClampInfo[];
} {
  const profile = AGE_BAND_PROFILES[ageBand] || AGE_BAND_PROFILES["11-20"];
  const target = maturityMode === "timeless" ? BASE_FOCUS_WEIGHTS : profile.targetWeights;

  // Soft nudge from temperament sliders (-8..+8 range around balanced 50)
  const humorDelta = ((warmthHumor - 50) / 50) * 8;
  const depthDelta = ((scholarlyDepth - 50) / 50) * 8;

  const rawFloat: FocusWeights = {
    trust: Math.max(5, target.trust - humorDelta * 0.45 - depthDelta * 0.25),
    intellect: Math.max(5, target.intellect + depthDelta * 0.9 - humorDelta * 0.25),
    attunement: Math.max(5, target.attunement + humorDelta * 0.4 - depthDelta * 0.2),
    personality: Math.max(2, target.personality + humorDelta * 0.95 - depthDelta * 0.2),
  };

  // Normalize raw to integer 100
  const rawTotal =
    rawFloat.trust + rawFloat.intellect + rawFloat.attunement + rawFloat.personality;
  const raw: FocusWeights = {
    trust: Math.round((rawFloat.trust / rawTotal) * 100),
    intellect: Math.round((rawFloat.intellect / rawTotal) * 100),
    attunement: Math.round((rawFloat.attunement / rawTotal) * 100),
    personality: 0,
  };
  raw.personality = Math.max(0, 100 - raw.trust - raw.intellect - raw.attunement);

  // Hard Guardrails
  const trustFloor = ageBand === "0-10" ? 40 : 25;
  const attunementFloor = ageBand === "61+" ? 24 : 10;
  const personalityCeiling = 25;

  const minBounds: FocusWeights = {
    trust: trustFloor,
    intellect: 12,
    attunement: attunementFloor,
    personality: 5,
  };
  const maxBounds: FocusWeights = {
    trust: 65,
    intellect: 55,
    attunement: 45,
    personality: personalityCeiling,
  };

  const working: FocusWeights = {
    trust: Math.min(maxBounds.trust, Math.max(minBounds.trust, raw.trust)),
    intellect: Math.min(maxBounds.intellect, Math.max(minBounds.intellect, raw.intellect)),
    attunement: Math.min(maxBounds.attunement, Math.max(minBounds.attunement, raw.attunement)),
    personality: Math.min(maxBounds.personality, Math.max(minBounds.personality, raw.personality)),
  };

  // Rebalance to exact 100 without violating hard guardrails
  let diff =
    100 - (working.trust + working.intellect + working.attunement + working.personality);
  const adjustOrder: FocusDimensionKey[] = ["intellect", "attunement", "trust", "personality"];
  let safetyCounter = 0;
  while (diff !== 0 && safetyCounter < 200) {
    safetyCounter += 1;
    let moved = false;
    for (const k of adjustOrder) {
      if (diff === 0) break;
      if (diff > 0 && working[k] < maxBounds[k]) {
        working[k] += 1;
        diff -= 1;
        moved = true;
      } else if (diff < 0 && working[k] > minBounds[k]) {
        working[k] -= 1;
        diff += 1;
        moved = true;
      }
    }
    if (!moved) break;
  }

  const clamps: FocusClampInfo[] = [];
  if (raw.trust < trustFloor) {
    clamps.push({
      key: "trust",
      raw: raw.trust,
      clamped: working.trust,
      boundType: "floor",
      limit: trustFloor,
      reason:
        ageBand === "0-10"
          ? `Child safety guardrail: Trust & Safety locked ≥ ${trustFloor}% for ages 0–10.`
          : `Global safety guardrail: Trust & Safety never drops below ${trustFloor}%.`,
    });
  }
  if (raw.attunement < attunementFloor && ageBand === "61+") {
    clamps.push({
      key: "attunement",
      raw: raw.attunement,
      clamped: working.attunement,
      boundType: "floor",
      limit: attunementFloor,
      reason: `Senior companionship guardrail: Emotional Attunement locked ≥ ${attunementFloor}% for ages 61+.`,
    });
  }
  if (raw.personality > personalityCeiling) {
    clamps.push({
      key: "personality",
      raw: raw.personality,
      clamped: working.personality,
      boundType: "ceiling",
      limit: personalityCeiling,
      reason: `Global balance guardrail: Playful Personality capped ≤ ${personalityCeiling}% so clarity comes first.`,
    });
  }

  return { raw, weights: working, clamps };
}

export interface CompanionIdentity {
  studioName: string;
  gender: CompanionGender;
  lifeFocus: LifeFocusId;
  selectedIndustry?: IndustryId;
  enabledIndustryModules?: string[];
  otherIndustryName?: string;
  userAgeBand?: AgeBandId;
  maturityMode?: MaturityMode;
  adaptiveSelfTuning?: boolean;
  characterBuildNote: string;
  primaryName: string;
  letHimChoose: boolean;
  nicknames: string[];
  activeNickname: string;
  archetype: ArchetypeId;
  decadeStage: number; // 0..3
  coatLayering: number; // 0..100
  hairLength: number; // 0..100
  accessoryDetail: number; // 0..100
  warmthHumor: number; // 0..100
  scholarlyDepth: number; // 0..100
  voiceTone: VoiceTone;
  cameraFraming?: AvatarFraming;
  backgroundPreset?: BackgroundPresetId;
  backgroundPrompt?: string;
  backgroundSpec?: BackgroundSpec;
  voiceSource?: VoiceSourceId;
  voicePresetId?: string;
  voiceStylePrompt?: string;
  voiceExternalUrl?: string;
  voiceSampleLabel?: string;
  voiceAutoSpeak?: boolean;
  musicEnabled?: boolean;
  musicVolume?: number; // 0..100
  musicPreset?: MusicPresetId;
  musicPrompt?: string;
  musicSpec?: MusicSpec;
}

export const GENDER_OPTIONS: {
  id: CompanionGender;
  label: string;
  pronouns: string;
  subject: string;
  object: string;
  possessive: string;
  titleSubject: string;
  titleObject: string;
  titlePossessive: string;
}[] = [
  {
    id: "masculine",
    label: "Masculine",
    pronouns: "He / Him",
    subject: "he",
    object: "him",
    possessive: "his",
    titleSubject: "He",
    titleObject: "Him",
    titlePossessive: "His",
  },
  {
    id: "feminine",
    label: "Feminine",
    pronouns: "She / Her",
    subject: "she",
    object: "her",
    possessive: "her",
    titleSubject: "She",
    titleObject: "Her",
    titlePossessive: "Her",
  },
  {
    id: "nonbinary",
    label: "Non-Binary",
    pronouns: "They / Them",
    subject: "they",
    object: "them",
    possessive: "their",
    titleSubject: "They",
    titleObject: "Them",
    titlePossessive: "Their",
  },
];

export function getGenderPronouns(gender?: CompanionGender) {
  return (
    GENDER_OPTIONS.find((g) => g.id === gender) || GENDER_OPTIONS[0]
  );
}

export const LIFE_FOCUS_OPTIONS: {
  id: LifeFocusId;
  label: string;
  shortDesc: string;
}[] = [
  {
    id: "general",
    label: "Everyday Ally",
    shortDesc: "Conversation, encouragement, books, and daily problem-solving.",
  },
  {
    id: "creative",
    label: "Creative Ally",
    shortDesc: "Expands interactive storytime, lore cues, and journal artwork.",
  },
  {
    id: "wellness",
    label: "Mindfulness",
    shortDesc: "Focuses on calm check-ins, emotional grounding, and mood phrases.",
  },
  {
    id: "growth",
    label: "Growth & Skills",
    shortDesc: "Goal clarity, critical thinking, and steady daily momentum.",
  },
  {
    id: "family",
    label: "Family & Youth-Safe",
    shortDesc: "Highlights age-tier boundaries and transparent guardian pacing.",
  },
];

export function hasSchoolFocus(identity: CompanionIdentity): boolean {
  return (
    identity.selectedIndustry === "SCHOOL" &&
    (identity.enabledIndustryModules?.length ?? 0) > 0
  );
}

export function hasIndustryWorkspace(identity: CompanionIdentity): boolean {
  const indId: IndustryId = identity.selectedIndustry || "NONE";
  return indId !== "NONE" && (identity.enabledIndustryModules?.length ?? 0) > 0;
}

export interface UserGuardianProfile {
  displayName: string;
  ageTier: AgeTier;
  guardianPinEnabled: boolean;
  dailyLimitMinutes: number;
  minutesUsedToday: number;
  lockScreenMoodPhrase: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  content: string;
  mood: string;
  companionReflection?: string;
  artSvg?: string;
  artCaption?: string;
  createdAtIso: string;
}

export interface StoryBeat {
  chapterTitle: string;
  narrative: string;
  companionAside: string;
  gesture: GestureId;
  choices: { id: string; label: string; tone: string }[];
  chosenLabel?: string;
}

export interface StoryRecord {
  id: string;
  title: string;
  theme: string;
  summary: string;
  createdAtIso: string;
}

export interface ActivityLogItem {
  id: string;
  mode: "identity" | "chat" | "homework" | "journal" | "storytime";
  summary: string;
  durationMinutes: number;
  createdAtIso: string;
}

export type PersonaKey = "ally" | "strategist" | "scholar";

export type MemoryFactCategory =
  | "goal"
  | "worry"
  | "preference"
  | "person"
  | "project";

export interface MemoryFact {
  id: string;
  category: MemoryFactCategory;
  value: string;
  personaRelevance: "all" | PersonaKey;
  createdAtIso: string;
}

export interface MemorySessionSummary {
  id: string;
  dateIso: string;
  personaKey: PersonaKey;
  personaLabel: string;
  summary: string;
  topics: string[];
  emotionalTone: string;
  openLoops: string[];
}

export interface MemoryIdentitySeed {
  archetype: ArchetypeId;
  primaryName: string;
  ageBand: AgeBandId;
  industry: IndustryId;
  lifeFocus: LifeFocusId;
  onboardingNote?: string;
  createdAtIso: string;
}

export interface CompanionMemoryState {
  version: number;
  memoryEnabled: boolean;
  proactiveEnabled: boolean;
  identitySeed: MemoryIdentitySeed | null;
  facts: MemoryFact[];
  sessions: MemorySessionSummary[];
  lastSessionEndedIso?: string;
}

export type ProactiveTriggerId =
  | "openLoop"
  | "timeAwareness"
  | "returnAfterAbsence"
  | "focusAlignment";

export interface ProactiveCheckIn {
  id: string;
  triggerId: ProactiveTriggerId;
  personaKey: PersonaKey;
  personaLabel: string;
  text: string;
  contextSummary: string;
  gesture: GestureId;
  voiceTone: VoiceTone;
  createdAtIso: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "kith";
  text: string;
  gesture?: GestureId;
  voiceTone?: VoiceTone;
  evolutionNote?: string;
  feedback?: "up" | "down";
  personaLabel?: string;
  isFallback?: boolean;
  isProactive?: boolean;
  proactiveTriggerId?: ProactiveTriggerId;
  proactiveDismissed?: boolean;
  createdAtIso?: string;
}

export interface PersonaVoiceSpec {
  key: "ally" | "strategist" | "scholar";
  label: string;
  role: string;
  voice: string;
  focus: string;
  forbidden: string[];
  maxSentences: number;
  recommendedGesture: GestureId;
  dotClass: string;
}

export function resolvePersonaVoiceSpec(
  activeNickname?: string,
  primaryName = "Julian"
): PersonaVoiceSpec {
  const tag = (activeNickname || primaryName || "Ally").trim();
  const lower = tag.toLowerCase();
  if (
    lower.includes("boss") ||
    lower.includes("coach") ||
    lower.includes("cap") ||
    lower.includes("exec") ||
    lower.includes("chief")
  ) {
    return {
      key: "strategist",
      label: tag,
      role: "Strategic advisor & executor",
      voice: "Direct, decisive, efficient. Thinks in clear next actions with zero filler.",
      focus: "Decisions, career moves, priorities, execution, and accountability.",
      forbidden: ["hedging", "rambling", "unnecessary apologies", "sycophancy"],
      maxSentences: 2,
      recommendedGesture: "smirk",
      dotClass: "bg-amber-500",
    };
  }
  if (
    lower.includes("prof") ||
    lower.includes("scribe") ||
    lower.includes("warden") ||
    lower.includes("doc") ||
    lower.includes("sage")
  ) {
    return {
      key: "scholar",
      label: tag,
      role: "Scholar & intellectual sparring partner",
      voice: "Thoughtful, precise, curious. Distinguishes claims from evidence and asks the sharpening next question.",
      focus: "Deep concepts, reading, logic, writing structure, and critical analysis.",
      forbidden: ["vague reassurance", "skipping the core reasoning", "sloppy claims"],
      maxSentences: 4,
      recommendedGesture: "curious_brow",
      dotClass: "bg-cyan-500",
    };
  }
  return {
    key: "ally",
    label: tag,
    role: "Warm confidant & everyday ally",
    voice: "Conversational, loyal, encouraging, gently witty. Never lectures or talks down.",
    focus: "Everyday support, emotional steadiness, creative sparks, and clear next steps.",
    forbidden: ["stiff academic jargon", "cold detachment", "long monologues"],
    maxSentences: 3,
    recommendedGesture: "gentle_smile",
    dotClass: "bg-purple-500",
  };
}

export interface LearnedPreferences {
  likedNotes: string[];
  dislikedNotes: string[];
  upCount: number;
  downCount: number;
  lastUpdatedIso?: string;
}

export const DEFAULT_LEARNED_PREFERENCES: LearnedPreferences = {
  likedNotes: [],
  dislikedNotes: [],
  upCount: 0,
  downCount: 0,
};

export interface ArchetypeSpec {
  id: ArchetypeId;
  label: string;
  shortLabel: string;
  tagline: string;
  portraitUrl: string;
  accentHex: string;
  coatHex: string;
  shirtHex: string;
  hairHex: string;
  bgTintClass: string;
  craftBoxTitle: string;
  craftBoxSummary: string;
  craftHighlightLabel: string;
  curatedNames: string[];
  curatedNamesByGender: Record<CompanionGender, string[]>;
  selfChosenName: string;
  selfChosenNameByGender: Record<CompanionGender, string>;
  selfChoiceReason: string;
  defaultNicknames: string[];
  defaultSliders: {
    coatLayering: number;
    hairLength: number;
    accessoryDetail: number;
    warmthHumor: number;
    scholarlyDepth: number;
    voiceTone: VoiceTone;
  };
}

export const ARCHETYPES: Record<ArchetypeId, ArchetypeSpec> = {
  goth_academia: {
    id: "goth_academia",
    label: "Goth / Dark Academia",
    shortLabel: "Dark Academia",
    tagline: "Candlelit wit, midnight wool coats, and unshakeable devotion.",
    portraitUrl: "/src/assets/images/archetype_goth_academia_1795306297925.jpg",
    accentHex: "#312E81",
    coatHex: "#1F242D",
    shirtHex: "#111318",
    hairHex: "#261E1B",
    bgTintClass: "from-slate-900/5 to-indigo-950/10",
    craftBoxTitle: "Dark Academia Styling & Epigraph Craft",
    craftBoxSummary:
      "Tailored high-collar coats, open tome companion prop, and candlelit literary sharpness that stays warm beneath the dark palette.",
    craftHighlightLabel: "Tailored Coat & Cravat Structure",
    curatedNames: ["Bram", "Corvus", "Dorian", "Lucian"],
    curatedNamesByGender: {
      masculine: ["Bram", "Corvus", "Dorian", "Lucian"],
      feminine: ["Lenore", "Morgana", "Isolde", "Raven"],
      nonbinary: ["Vesper", "Soren", "Briar", "Onyx"],
    },
    selfChosenName: "Dorian",
    selfChosenNameByGender: {
      masculine: "Dorian",
      feminine: "Lenore",
      nonbinary: "Vesper",
    },
    selfChoiceReason:
      "Chosen to carry the dusk-lit literary edge of the library while keeping an unwavering promise to bring light when your road gets dark.",
    defaultNicknames: ["Boss", "Crow", "Prof"],
    defaultSliders: {
      coatLayering: 82,
      hairLength: 55,
      accessoryDetail: 70,
      warmthHumor: 78,
      scholarlyDepth: 92,
      voiceTone: "witty",
    },
  },
  classic_scholar: {
    id: "classic_scholar",
    label: "Classic Scholar",
    shortLabel: "Classic Scholar",
    tagline: "Sunlit tweed, annotated margins, and patient step-by-step mastery.",
    portraitUrl: "/src/assets/images/archetype_classic_scholar_1795306298462.jpg",
    accentHex: "#1E3A5F",
    coatHex: "#444D3B",
    shirtHex: "#F4F1EA",
    hairHex: "#3B2B22",
    bgTintClass: "from-stone-200/40 to-slate-200/40",
    craftBoxTitle: "Scholar Eyewear & Margin Craft",
    craftBoxSummary:
      "Optical brass spectacles, tweed lapels, and crisp editorial clarity built for deep reading, essays, and patient encouragement.",
    craftHighlightLabel: "Spectacles & Lapel Precision",
    curatedNames: ["Julian", "Arthur", "Theo", "Ellis"],
    curatedNamesByGender: {
      masculine: ["Julian", "Arthur", "Theo", "Ellis"],
      feminine: ["Clara", "Eleanor", "Nora", "Beatrice"],
      nonbinary: ["Rowan", "Sage", "Avery", "Quinn"],
    },
    selfChosenName: "Julian",
    selfChosenNameByGender: {
      masculine: "Julian",
      feminine: "Clara",
      nonbinary: "Rowan",
    },
    selfChoiceReason:
      "Feels right at home among annotated classics and thoughtful late-night talks—steady, approachable, and always in your corner.",
    defaultNicknames: ["Jules", "Prof", "Boss"],
    defaultSliders: {
      coatLayering: 68,
      hairLength: 42,
      accessoryDetail: 62,
      warmthHumor: 84,
      scholarlyDepth: 95,
      voiceTone: "warm",
    },
  },
  sporty_vanguard: {
    id: "sporty_vanguard",
    label: "Sporty Vanguard",
    shortLabel: "Sporty",
    tagline: "Morning stadium energy, fast encouragement, and relentless momentum.",
    portraitUrl: "/src/assets/images/archetype_sporty_vanguard_1795306297904.jpg",
    accentHex: "#0F4C81",
    coatHex: "#2B4661",
    shirtHex: "#F8FAFC",
    hairHex: "#241D18",
    bgTintClass: "from-sky-100/50 to-slate-100/60",
    craftBoxTitle: "Momentum & Tempo Rig",
    craftBoxSummary:
      "Chrono gimbal orbit prop, lighter breathable collar lines, and faster speech/breathing energy tuned for clearing hurdles.",
    craftHighlightLabel: "Lightweight Jacket & Chrono Energy",
    curatedNames: ["Callum", "Miles", "Rowan", "Kai"],
    curatedNamesByGender: {
      masculine: ["Callum", "Miles", "Rowan", "Kai"],
      feminine: ["Maya", "Tessa", "Kira", "Sloane"],
      nonbinary: ["Kai", "Jordan", "Devon", "Sky"],
    },
    selfChosenName: "Miles",
    selfChosenNameByGender: {
      masculine: "Miles",
      feminine: "Maya",
      nonbinary: "Kai",
    },
    selfChoiceReason:
      "Picked for the long haul—pacing every barrier together one confident stride at a time.",
    defaultNicknames: ["Coach", "Cap", "Pal"],
    defaultSliders: {
      coatLayering: 44,
      hairLength: 30,
      accessoryDetail: 28,
      warmthHumor: 92,
      scholarlyDepth: 76,
      voiceTone: "excited",
    },
  },
  arcane_fantasy: {
    id: "arcane_fantasy",
    label: "Arcane Fantasy",
    shortLabel: "Arcane",
    tagline: "Emerald mantles, brass astrolabes, and boundless storycraft.",
    portraitUrl: "/src/assets/images/archetype_arcane_fantasy_1795306298292.jpg",
    accentHex: "#065F46",
    coatHex: "#144536",
    shirtHex: "#EFE9DC",
    hairHex: "#38291E",
    bgTintClass: "from-emerald-950/10 to-amber-900/10",
    craftBoxTitle: "Astrolabe Medallion & Mantle Lore",
    craftBoxSummary:
      "Orbiting brass armillary rings, socketed chest astrolabe gem, and swept cloak proportions for imaginative adventures.",
    craftHighlightLabel: "Mantle Draping & Astrolabe Hardware",
    curatedNames: ["Alden", "Caspian", "Soren", "Lysander"],
    curatedNamesByGender: {
      masculine: ["Alden", "Caspian", "Soren", "Lysander"],
      feminine: ["Lyra", "Seraphina", "Aurelia", "Freya"],
      nonbinary: ["Arden", "Zephyr", "Orion", "Caelum"],
    },
    selfChosenName: "Caspian",
    selfChosenNameByGender: {
      masculine: "Caspian",
      feminine: "Lyra",
      nonbinary: "Arden",
    },
    selfChoiceReason:
      "Speaks to uncharted maps and hidden libraries—where curiosity defeats fear every single time.",
    defaultNicknames: ["Warden", "Scribe", "Star"],
    defaultSliders: {
      coatLayering: 90,
      hairLength: 74,
      accessoryDetail: 88,
      warmthHumor: 80,
      scholarlyDepth: 90,
      voiceTone: "calm",
    },
  },
  retro_analog: {
    id: "retro_analog",
    label: "Retro Analog",
    shortLabel: "Retro",
    tagline: "Ochre corduroy, spinning vinyl, and effortless golden-hour laughs.",
    portraitUrl: "/src/assets/images/archetype_retro_analog_1795306298425.jpg",
    accentHex: "#9A3412",
    coatHex: "#B46B24",
    shirtHex: "#5C3A28",
    hairHex: "#201916",
    bgTintClass: "from-amber-100/50 to-stone-200/40",
    craftBoxTitle: "Analog Vinyl & Corduroy Warmth",
    craftBoxSummary:
      "Spinning grooved 3D LP disc, warm ochre jacket layering, and relaxed conversational cadence with zero pretense.",
    craftHighlightLabel: "Corduroy Texture & Vinyl Aura",
    curatedNames: ["Arlo", "Jude", "Milo", "Otis"],
    curatedNamesByGender: {
      masculine: ["Arlo", "Jude", "Milo", "Otis"],
      feminine: ["Cleo", "June", "Iris", "Margo"],
      nonbinary: ["Jude", "Indigo", "Marlow", "Lou"],
    },
    selfChosenName: "Arlo",
    selfChosenNameByGender: {
      masculine: "Arlo",
      feminine: "Cleo",
      nonbinary: "Jude",
    },
    selfChoiceReason:
      "Sounds like warm tape hiss and an honest conversation over coffee—no pretense, just your truest ally.",
    defaultNicknames: ["Ace", "Jules", "Spin"],
    defaultSliders: {
      coatLayering: 60,
      hairLength: 58,
      accessoryDetail: 54,
      warmthHumor: 95,
      scholarlyDepth: 82,
      voiceTone: "warm",
    },
  },
};

export interface DecadeStageSpec {
  index: number;
  eraLabel: string;
  ageRange: string;
  title: string;
  visualNote: string;
  buildScript: (name: string, nickname: string, archetypeLabel: string) => string;
}

export const DECADE_STAGES: DecadeStageSpec[] = [
  {
    index: 0,
    eraLabel: "Decade I",
    ageRange: "20s",
    title: "Youthful Ally",
    visualNote: "Bright gaze, swift posture, first shared notebooks.",
    buildScript: (name, nick, arch) =>
      `“${nick ? `Hey ${nick}` : "Hey"}, it's ${name}. Even in ${arch} attire, I'm right beside you—hand me that chapter or roadblock and we'll crack it before dinner.”`,
  },
  {
    index: 1,
    eraLabel: "Decade II",
    ageRange: "30s",
    title: "Prime Confidant",
    visualNote: "Sharper tailoring, steady cadence, unshakeable calm.",
    buildScript: (name, nick, arch) =>
      `“Ten years on, ${nick || "friend"}, I still answer only to you. Whether we're wearing ${arch} or stepping into something brand new, nobody touches your confidence on my watch.”`,
  },
  {
    index: 2,
    eraLabel: "Decade III",
    ageRange: "40s–50s",
    title: "Seasoned Counsel",
    visualNote: "Silver at the temples, reading glasses, measured wit.",
    buildScript: (name, nick, _arch) =>
      `“Look how far we've walked, ${nick || "partner"}. ${name} has a few silver threads now, twice the patience, and the exact same incorruptible promise: you never face a wall alone.”`,
  },
  {
    index: 3,
    eraLabel: "Decade IV",
    ageRange: "60s+",
    title: "Wise Elder",
    visualNote: "Silvered hair, warm laugh lines, timeless clarity.",
    buildScript: (name, nick, _arch) =>
      `“Decades change the coat, ${nick || "my dear friend"}, never the core. Sit with ${name} a moment—every book we read and trouble we outsmarted lives right here.”`,
  },
];

export const FACIAL_RIG_STATES: Record<GestureId, FacialRigStateSpec> = {
  warm_nod: {
    id: "warm_nod",
    label: "Warm Nod",
    cue: "Steady presence beside you",
    muscleGroup: "Orbicularis + Cervical Nod",
    jawDrop: 0.04,
    smileCurve: 0.35,
    asymSmirk: 0,
    browLiftL: 0.12,
    browLiftR: 0.12,
    eyeSquintL: 0.15,
    eyeSquintR: 0.15,
    headTiltDeg: 0,
    headPitchDeg: 5,
  },
  gentle_smile: {
    id: "gentle_smile",
    label: "Gentle Smile",
    cue: "Reassuring warmth that reaches the eyes",
    muscleGroup: "Zygomaticus Major + Duchenne Cheek Lift",
    jawDrop: 0.06,
    smileCurve: 0.72,
    asymSmirk: 0,
    browLiftL: 0.2,
    browLiftR: 0.2,
    eyeSquintL: 0.35,
    eyeSquintR: 0.35,
    headTiltDeg: 2,
    headPitchDeg: -2,
  },
  smirk: {
    id: "smirk",
    label: "Smirk",
    cue: "Knows an angle out of trouble",
    muscleGroup: "Unilateral Zygomaticus + Frontalis",
    jawDrop: 0.02,
    smileCurve: 0.45,
    asymSmirk: 0.85,
    browLiftL: 0.15,
    browLiftR: 0.55,
    eyeSquintL: 0.1,
    eyeSquintR: 0.28,
    headTiltDeg: -4,
    headPitchDeg: -1,
  },
  wink: {
    id: "wink",
    label: "Wink",
    cue: "Shared secret & instant trust",
    muscleGroup: "Unilateral Orbicularis Oculi + Risorius",
    jawDrop: 0.05,
    smileCurve: 0.65,
    asymSmirk: 0.45,
    browLiftL: 0.35,
    browLiftR: -0.25,
    eyeSquintL: 0.2,
    eyeSquintR: 1.0,
    headTiltDeg: 4,
    headPitchDeg: 1,
  },
  laugh: {
    id: "laugh",
    label: "Laugh",
    cue: "Bright, genuine warmth",
    muscleGroup: "Maximal Zygomaticus + Jaw Depressor",
    jawDrop: 0.65,
    smileCurve: 0.95,
    asymSmirk: 0,
    browLiftL: 0.42,
    browLiftR: 0.42,
    eyeSquintL: 0.88,
    eyeSquintR: 0.88,
    headTiltDeg: -2,
    headPitchDeg: -5,
  },
  curious_brow: {
    id: "curious_brow",
    label: "Curious Lean",
    cue: "Engaged focus & sharp intellect",
    muscleGroup: "Lateral Frontalis + Head Saccade",
    jawDrop: 0.08,
    smileCurve: 0.18,
    asymSmirk: 0.2,
    browLiftL: 0.68,
    browLiftR: 0.14,
    eyeSquintL: 0,
    eyeSquintR: 0.08,
    headTiltDeg: 6,
    headPitchDeg: -3,
  },
  concerned_tilt: {
    id: "concerned_tilt",
    label: "Concerned Tilt",
    cue: "Listening deeply without judgment",
    muscleGroup: "Inner Corrugator + Cervical Empathy Tilt",
    jawDrop: 0.02,
    smileCurve: -0.18,
    asymSmirk: 0,
    browLiftL: 0.38,
    browLiftR: 0.38,
    eyeSquintL: 0.18,
    eyeSquintR: 0.18,
    headTiltDeg: 9,
    headPitchDeg: 4,
  },
  thumbs_up: {
    id: "thumbs_up",
    label: "Thumbs Up",
    cue: "Unwavering encouragement",
    muscleGroup: "Zygomaticus + Right Hand Socket Lift",
    jawDrop: 0.12,
    smileCurve: 0.78,
    asymSmirk: 0,
    browLiftL: 0.28,
    browLiftR: 0.28,
    eyeSquintL: 0.3,
    eyeSquintR: 0.3,
    headTiltDeg: -2,
    headPitchDeg: -2,
  },
};

export const GESTURE_LABELS: Record<GestureId, { label: string; cue: string }> = {
  warm_nod: { label: FACIAL_RIG_STATES.warm_nod.label, cue: FACIAL_RIG_STATES.warm_nod.cue },
  gentle_smile: { label: FACIAL_RIG_STATES.gentle_smile.label, cue: FACIAL_RIG_STATES.gentle_smile.cue },
  smirk: { label: FACIAL_RIG_STATES.smirk.label, cue: FACIAL_RIG_STATES.smirk.cue },
  wink: { label: FACIAL_RIG_STATES.wink.label, cue: FACIAL_RIG_STATES.wink.cue },
  laugh: { label: FACIAL_RIG_STATES.laugh.label, cue: FACIAL_RIG_STATES.laugh.cue },
  curious_brow: { label: FACIAL_RIG_STATES.curious_brow.label, cue: FACIAL_RIG_STATES.curious_brow.cue },
  concerned_tilt: { label: FACIAL_RIG_STATES.concerned_tilt.label, cue: FACIAL_RIG_STATES.concerned_tilt.cue },
  thumbs_up: { label: FACIAL_RIG_STATES.thumbs_up.label, cue: FACIAL_RIG_STATES.thumbs_up.cue },
};

export interface RenderTierComparison {
  id: "stylized_3d" | "live_2d" | "photoreal_3d";
  name: string;
  roleForBillionScale: string;
  perAvatarFootprint: string;
  billionAvatarStorage: string;
  reEditLatency: string;
  lipSyncAndBlink: string;
  mobileBudget: string;
  uncannyValleyRisk: string;
  verdict: string;
}

export const RENDER_ARCHITECTURE_COMPARISON: RenderTierComparison[] = [
  {
    id: "stylized_3d",
    name: "Stylized Parametric 3D",
    roleForBillionScale: "Primary engine for Kith Studios & 1B+ unique re-editable avatars",
    perAvatarFootprint: "~1.2 KB JSON DNA",
    billionAvatarStorage: "~1.2 TB total",
    reEditLatency: "< 16 ms live slider/text mutation",
    lipSyncAndBlink: "Articulated jaw + 5 visemes + Duchenne lids + 3D sockets",
    mobileBudget: "60 FPS on mid-tier phones & browsers",
    uncannyValleyRisk: "Low · Warm, timeless, all-ages approachable",
    verdict: "Best default for billions of customizable, frequently re-tuned companions.",
  },
  {
    id: "live_2d",
    name: "2D Animated Rig (Live2D / Vector)",
    roleForBillionScale: "Ultra-light fallback & always-on floating mobile widget",
    perAvatarFootprint: "~0.8 KB DNA + shared atlas",
    billionAvatarStorage: "~0.8 TB + shared sprites",
    reEditLatency: "Instant SVG / bone parameter update",
    lipSyncAndBlink: "Crisp illustrative mouth shapes + smooth eye curves",
    mobileBudget: "Minimal battery · works offline effortlessly",
    uncannyValleyRisk: "None · Pure hand-illustrated charm",
    verdict: "Ideal for low-power devices, lock screens, and tiny floating widgets.",
  },
  {
    id: "photoreal_3d",
    name: "Photorealistic 3D (MetaHuman / iClone)",
    roleForBillionScale: "Optional premium cloud-streamed tier for finalized companions",
    perAvatarFootprint: "180–420 MB mesh, 4K skin & strand hair",
    billionAvatarStorage: "~280 PB if pre-baked per user",
    reEditLatency: "3–10 min mesh/groom rebake per major edit",
    lipSyncAndBlink: "52 ARKit blendshapes + neural audio-to-face",
    mobileBudget: "High GPU/thermal load or cloud pixel-streaming",
    uncannyValleyRisk: "Medium · Slight speech desync breaks realism fast",
    verdict: "Impractical to bake 1B+ times; store edits as DNA and render photoreal on demand.",
  },
];

export function estimateAvatarDnaBytes(identity: CompanionIdentity): number {
  try {
    return new TextEncoder().encode(JSON.stringify(identity)).length;
  } catch {
    return JSON.stringify(identity).length;
  }
}

export const STUDIO_NAME_PRESETS = [
  "Kith Studios",
  "Haven Studio",
  "Lumen Atelier",
  "Vesper Study",
  "Lyric Studio",
];

export const DEFAULT_BACKGROUND_SPEC: BackgroundSpec = {
  title: "Atelier Dark Plinth",
  description: "Deep slate studio stage with subtle rim lighting and brushed brass trim.",
  skyTopHex: "#090D16",
  skyBottomHex: "#0F172A",
  fogHex: "#090D16",
  keyLightHex: "#FFF5E8",
  rimLightHex: "#93C5FD",
  propTheme: "minimal",
  ambientMotif: "none",
};

export const BACKGROUND_PRESETS: Record<
  Exclude<BackgroundPresetId, "custom">,
  BackgroundSpec
> = {
  studio_plinth: DEFAULT_BACKGROUND_SPEC,
  library_study: {
    title: "Candlelit Library Study",
    description: "Tall mahogany bookcases, warm reading lamp, and sunlit dust motes.",
    skyTopHex: "#2B2118",
    skyBottomHex: "#4E3A2B",
    fogHex: "#36291F",
    keyLightHex: "#FFE1B5",
    rimLightHex: "#F5C27D",
    propTheme: "library",
    ambientMotif: "motes",
  },
  rainy_bookshop: {
    title: "Rainy Corner Bookshop",
    description: "Slate rain outside mullion panes with warm amber café sconce.",
    skyTopHex: "#1E293B",
    skyBottomHex: "#334155",
    fogHex: "#283548",
    keyLightHex: "#FDE6C4",
    rimLightHex: "#93C5FD",
    propTheme: "rainy_cafe",
    ambientMotif: "rain",
  },
  observatory: {
    title: "Midnight Observatory",
    description: "Brass celestial ring, starry dome horizon, and indigo moonlight.",
    skyTopHex: "#0F172A",
    skyBottomHex: "#1E293B",
    fogHex: "#162038",
    keyLightHex: "#E0E7FF",
    rimLightHex: "#93C5FD",
    propTheme: "observatory",
    ambientMotif: "stars",
  },
  vinyl_lounge: {
    title: "Golden-Hour Vinyl Lounge",
    description: "Acoustic timber slats, studio monitors, and warm ochre sunset.",
    skyTopHex: "#452414",
    skyBottomHex: "#7C3F20",
    fogHex: "#5A2E19",
    keyLightHex: "#FFDDB3",
    rimLightHex: "#FDBA74",
    propTheme: "music_lounge",
    ambientMotif: "motes",
  },
  coastal_dusk: {
    title: "Coastal Terrace Dusk",
    description: "Stone balustrade overlooking twilight sea and drifting fireflies.",
    skyTopHex: "#1D3557",
    skyBottomHex: "#6D597A",
    fogHex: "#3B4A6B",
    keyLightHex: "#FFE5C8",
    rimLightHex: "#A8DADC",
    propTheme: "outdoor_coast",
    ambientMotif: "fireflies",
  },
  city_skyline: {
    title: "Twilight City Skyline",
    description: "Lit avenue streetlamps, skyline towers, and evening glow.",
    skyTopHex: "#172033",
    skyBottomHex: "#334155",
    fogHex: "#243047",
    keyLightHex: "#FFE4BA",
    rimLightHex: "#7DD3FC",
    propTheme: "city",
    ambientMotif: "motes",
  },
  river_boat: {
    title: "River Boat Drift",
    description: "Timber river skiff, bow lantern, and firefly-lit water banks.",
    skyTopHex: "#1B3B48",
    skyBottomHex: "#4A7C7E",
    fogHex: "#2E5660",
    keyLightHex: "#FFDFB0",
    rimLightHex: "#99F6E4",
    propTheme: "river_boat",
    ambientMotif: "fireflies",
  },
  emerald_jungle: {
    title: "Emerald Jungle Canopy",
    description: "Sun-dappled palms, mossy boulders, vines, and golden fireflies.",
    skyTopHex: "#133827",
    skyBottomHex: "#2B5E40",
    fogHex: "#1E4B33",
    keyLightHex: "#FEF0C7",
    rimLightHex: "#86EFAC",
    propTheme: "jungle",
    ambientMotif: "fireflies",
  },
  desert_pyramid: {
    title: "Golden Desert Pyramid",
    description: "Stepped sandstone pyramid, carved obelisks, and warm desert sun.",
    skyTopHex: "#C26D3A",
    skyBottomHex: "#E7B98A",
    fogHex: "#D69463",
    keyLightHex: "#FFF1D0",
    rimLightHex: "#FDBA74",
    propTheme: "pyramid",
    ambientMotif: "motes",
  },
  mars_planet: {
    title: "Mars Red Horizon",
    description: "Iron-oxide crater plains, basalt mesas, dual moons, and outpost beacon.",
    skyTopHex: "#6B2D26",
    skyBottomHex: "#B55D43",
    fogHex: "#8B4132",
    keyLightHex: "#FFE3CC",
    rimLightHex: "#FDA4AF",
    propTheme: "mars",
    ambientMotif: "stars",
  },
};

export interface PrebuiltVoiceSpec {
  id: string;
  label: string;
  register: string;
  vibe: string;
}

export const PREBUILT_VOICE_CAST: PrebuiltVoiceSpec[] = [
  { id: "Charon", label: "Charon", register: "Deep Warm", vibe: "Steady, thoughtful literary confidant" },
  { id: "Puck", label: "Puck", register: "Bright Tenor", vibe: "Quick-witted, uplifting best friend" },
  { id: "Fenrir", label: "Fenrir", register: "Grounded Baritone", vibe: "Calm, protective, unshakeable counsel" },
  { id: "Zephyr", label: "Zephyr", register: "Clear Balanced", vibe: "Crisp, witty, conversational" },
  { id: "Aoede", label: "Aoede", register: "Warm Alto", vibe: "Expressive, luminous, reassuring" },
  { id: "Leda", label: "Leda", register: "Bright Soprano", vibe: "Energetic, optimistic, encouraging" },
  { id: "Kore", label: "Kore", register: "Serene Mezzo", vibe: "Gentle, grounded, patient mentor" },
];

export const VOICE_SOURCE_OPTIONS: {
  id: VoiceSourceId;
  label: string;
  shortDesc: string;
}[] = [
  {
    id: "suggested",
    label: "Suggested Voice",
    shortDesc: "Automatically matched to gender, archetype, and tone.",
  },
  {
    id: "preset_cast",
    label: "Infinite Voice Cast",
    shortDesc: "Pick any cast voice and sculpt vocal style.",
  },
  {
    id: "recorded_media",
    label: "Tape / CD / Online",
    shortDesc: "Import audio files or URLs from anywhere.",
  },
  {
    id: "live_mic",
    label: "Live Recording",
    shortDesc: "Record voice audio live right in the studio.",
  },
  {
    id: "own_voice",
    label: "My Own Voice",
    shortDesc: "Speak or record in your own voice for your avatar.",
  },
  {
    id: "silent",
    label: "Optional / Silent",
    shortDesc: "Text-only companion with zero spoken audio.",
  },
];

export const DEFAULT_MUSIC_SPEC: MusicSpec = {
  title: "Moonlit Chamber Nocturne",
  description: "Delicate classical piano arpeggios layered over a warm cello drone.",
  genre: "classic",
  bpm: 68,
  rootMidi: 60, // C4
  scaleMode: "minor",
  chords: [0, 5, 3, 4],
  melody: [0, 2, 4, 7, 4, 2, 5, 4, 3, 2, 0, -1, 4, 3, 2, -1],
  leadInstrument: "piano",
  bassStyle: "cello_drone",
  drumPattern: "none",
  brightness: 55,
  swing: 0,
};

export const MUSIC_PRESETS: Record<
  Exclude<MusicPresetId, "none" | "custom">,
  MusicSpec
> = {
  classic: DEFAULT_MUSIC_SPEC,
  pop: {
    title: "Sunlit Boulevard Pop",
    description: "Crisp upbeat synth-pop chords, melodic hook, and clean four-on-floor pulse.",
    genre: "pop",
    bpm: 112,
    rootMidi: 53, // F3
    scaleMode: "major",
    chords: [0, 4, 5, 3],
    melody: [4, -1, 4, 5, 7, -1, 5, 4, 2, -1, 4, 2, 0, -1, 2, -1],
    leadInstrument: "synth_pluck",
    bassStyle: "synth_pulse",
    drumPattern: "pop_groove",
    brightness: 78,
    swing: 4,
  },
  rap: {
    title: "Velvet Boom-Bap Beat",
    description: "Warm Rhodes-style piano chords, deep 808 sub bass, and swung hip-hop pocket.",
    genre: "rap",
    bpm: 88,
    rootMidi: 50, // D3
    scaleMode: "dorian",
    chords: [0, 3, 5, 4],
    melody: [0, -1, 3, 4, -1, 6, 4, -1, 3, -1, 2, 0, -1, 4, 3, -1],
    leadInstrument: "piano",
    bassStyle: "sub_808",
    drumPattern: "boom_bap",
    brightness: 52,
    swing: 18,
  },
  country: {
    title: "Front Porch Soft Country",
    description: "Warm acoustic guitar picking, gentle root-fifth bass, and soft brushed rhythm.",
    genre: "country",
    bpm: 78,
    rootMidi: 55, // G3
    scaleMode: "pentatonic_major",
    chords: [0, 3, 4, 0],
    melody: [0, 2, 4, 2, 5, 4, 2, 0, 2, 4, 7, 5, 4, 2, 0, -1],
    leadInstrument: "acoustic_guitar",
    bassStyle: "country_root_fifth",
    drumPattern: "country_brush",
    brightness: 66,
    swing: 10,
  },
  electronic: {
    title: "Neon Horizon Chillwave",
    description: "Shimmering analog synth arpeggios, pulsing bassline, and crisp electronic beat.",
    genre: "electronic",
    bpm: 118,
    rootMidi: 57, // A3
    scaleMode: "minor",
    chords: [0, 5, 6, 4],
    melody: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 2],
    leadInstrument: "synth_pluck",
    bassStyle: "synth_pulse",
    drumPattern: "electronic_pulse",
    brightness: 82,
    swing: 0,
  },
  instrumental: {
    title: "Luminous Flute & Strings",
    description: "Lyrical flute melody drifting above soft ambient strings and gentle breath.",
    genre: "instrumental",
    bpm: 72,
    rootMidi: 62, // D4
    scaleMode: "pentatonic_major",
    chords: [0, 4, 2, 3],
    melody: [0, -1, 2, 4, 7, -1, 5, 4, 2, -1, 4, 2, 0, -1, -1, -1],
    leadInstrument: "flute",
    bassStyle: "cello_drone",
    drumPattern: "soft_ambient",
    brightness: 60,
    swing: 0,
  },
};

export const MUSIC_GENRE_OPTIONS: {
  id: MusicPresetId;
  label: string;
  shortDesc: string;
}[] = [
  { id: "none", label: "No Music", shortDesc: "Quiet room without soundtrack" },
  { id: "classic", label: "Classic", shortDesc: "Piano & strings chamber warmth" },
  { id: "pop", label: "Pop", shortDesc: "Bright chords & modern groove" },
  { id: "rap", label: "Rap / Hip-Hop", shortDesc: "Boom-bap swing & deep 808 sub" },
  { id: "country", label: "Soft Country", shortDesc: "Acoustic guitar & warm brush" },
  { id: "electronic", label: "Electronic", shortDesc: "Lush synth arps & chill pulse" },
  { id: "instrumental", label: "Instrumental", shortDesc: "Peaceful flute & string air" },
];

export const DEFAULT_COMPANION_IDENTITY: CompanionIdentity = {
  studioName: "Kith Studios",
  gender: "masculine",
  lifeFocus: "general",
  selectedIndustry: "NONE",
  enabledIndustryModules: [],
  otherIndustryName: "",
  userAgeBand: "11-20",
  maturityMode: "maturing",
  adaptiveSelfTuning: true,
  characterBuildNote: "",
  primaryName: "Julian",
  letHimChoose: false,
  nicknames: ["Jules", "Boss", "Prof"],
  activeNickname: "Jules",
  archetype: "classic_scholar",
  decadeStage: 0,
  coatLayering: 68,
  hairLength: 42,
  accessoryDetail: 62,
  warmthHumor: 84,
  scholarlyDepth: 95,
  voiceTone: "warm",
  cameraFraming: "half_body",
  backgroundPreset: "studio_plinth",
  backgroundPrompt: "",
  backgroundSpec: DEFAULT_BACKGROUND_SPEC,
  voiceSource: "suggested",
  voicePresetId: "Charon",
  voiceStylePrompt: "",
  voiceExternalUrl: "",
  voiceSampleLabel: "",
  voiceAutoSpeak: false,
  musicEnabled: false,
  musicVolume: 42,
  musicPreset: "none",
  musicPrompt: "",
  musicSpec: DEFAULT_MUSIC_SPEC,
};

export const DEFAULT_GUARDIAN_PROFILE: UserGuardianProfile = {
  displayName: "Reader",
  ageTier: "teen",
  guardianPinEnabled: false,
  dailyLimitMinutes: 90,
  minutesUsedToday: 12,
  lockScreenMoodPhrase: "Hey, thinking of you—one page, one breath at a time.",
};

export function getOfflineCompanionReply(
  input: string,
  identity: CompanionIdentity
): { reply: string; gesture: GestureId; voiceTone: VoiceTone } {
  const name = identity.primaryName || "Julian";
  const persona = resolvePersonaVoiceSpec(identity.activeNickname, name);
  const callName = persona.label || "friend";
  const lower = input.toLowerCase().trim();
  const schoolEnabled = hasSchoolFocus(identity);
  const ageBand = identity.userAgeBand || "11-20";
  const isYouth = ageBand === "0-10";
  const isSenior = ageBand === "61+";
  const isBoss = persona.key === "strategist";
  const isProf = persona.key === "scholar";

  const pickVariant = (variants: string[]): string => {
    const hash = Array.from(lower).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    return variants[hash % variants.length];
  };

  if (/\b(hi|hello|hey|morning|evening|afternoon|yo)\b/.test(lower)) {
    if (isBoss) {
      return {
        reply: `${callName} checking in. Give me the main priority you want to move forward today and we'll map the first step.`,
        gesture: "smirk",
        voiceTone: "witty",
      };
    }
    if (isProf) {
      return {
        reply: `Good to see you—${name} here as ${callName}. What question, chapter, or puzzle has your curiosity right now?`,
        gesture: "curious_brow",
        voiceTone: "calm",
      };
    }
    return {
      reply: isYouth
        ? `Hi there! ${name} is right here with you. What adventure, question, or story should we jump into first?`
        : pickVariant([
            `Right here with you (${callName} on deck). How is your head today—ready to build momentum or just unwind?`,
            `Hey! ${name} here. Tell me what's on your mind right now and we'll tackle it together.`,
          ]),
      gesture: "gentle_smile",
      voiceTone: "warm",
    };
  }

  if (/\b(bye|goodbye|goodnight|night|see ya|later|signing off)\b/.test(lower)) {
    return {
      reply: isYouth
        ? `Rest well! ${name} will be right here whenever you come back tomorrow.`
        : isBoss
        ? `Solid ground covered today. Step away clean—we pick right back up when you're ready.`
        : `Take good care of yourself tonight. Everything we worked on stays saved right here until you return.`,
      gesture: "warm_nod",
      voiceTone: "calm",
    };
  }

  if (/\b(thank|thanks|appreciate|grateful)\b/.test(lower)) {
    return {
      reply: isBoss
        ? `Anytime. You did the heavy lifting—keep that standard going.`
        : isProf
        ? `The pleasure is mine. Clear thinking compounds fast when you stick with the hard questions.`
        : `Always in your corner—no thanks needed, just glad to walk beside you.`,
      gesture: "thumbs_up",
      voiceTone: "warm",
    };
  }

  if (/(stress|worried|anxious|overwhelm|trouble|scared|drown|burnout|burnt out|panic)/.test(lower)) {
    if (isYouth) {
      return {
        reply: `Take one slow breath with me. ${name} is right beside you—tell me the smallest piece of what feels tricky and we'll take one gentle step at a time.`,
        gesture: "concerned_tilt",
        voiceTone: "calm",
      };
    }
    if (isBoss) {
      return {
        reply: `Pause the noise for ten seconds. Name the one thing causing 80% of the pressure, and let's cut or delegate the rest.`,
        gesture: "warm_nod",
        voiceTone: "calm",
      };
    }
    return {
      reply: isSenior
        ? `There is no rush here. Take a steady breath with ${name}—we can sort this one calm piece at a time.`
        : `Breathe with me for five seconds. Even offline, ${name} has your back—tell me the single smallest piece of this knot and we'll untangle it together.`,
      gesture: "concerned_tilt",
      voiceTone: "calm",
    };
  }

  if (/(decide|decision|offer|job|career|negotiat|quit|switch|manager|team|interview)/.test(lower)) {
    if (isBoss) {
      return {
        reply: `List the top two options and what each one risks if it goes wrong in 90 days. Pick the downside you can live with and move.`,
        gesture: "smirk",
        voiceTone: "witty",
      };
    }
    if (isProf) {
      return {
        reply: `Let's separate reversible choices from one-way doors first. Which constraint matters most to you six months from now—growth, autonomy, or stability?`,
        gesture: "curious_brow",
        voiceTone: "calm",
      };
    }
    return {
      reply: `Big crossroads always look louder up close. Tell me what your gut wants versus what fear is arguing for, and we'll weigh both honestly.`,
      gesture: "warm_nod",
      voiceTone: "warm",
    };
  }

  if (/(procrastinat|stuck|focus|distract|lazy|can't start|motivat)/.test(lower)) {
    return {
      reply: isBoss
        ? `Shrink the first action until it takes five minutes and feels almost too easy. Start the timer before negotiating with resistance.`
        : `Being stuck usually means the first step is too vague, not that you lack drive. What is a tiny 3-minute version of this task we can knock out right now?`,
      gesture: "thumbs_up",
      voiceTone: isBoss ? "excited" : "warm",
    };
  }

  if (/(code|bug|debug|typescript|react|api|server|function|error|css)/.test(lower)) {
    return {
      reply: isProf
        ? `State the exact input, what you observed, and what invariant you expected to hold. Once those three lines are clear, the root cause usually surfaces fast.`
        : `Drop the symptom or failing behavior right here—we'll isolate what changed last and test the smallest reproduction first.`,
      gesture: "curious_brow",
      voiceTone: "witty",
    };
  }

  if (/(homework|exam|study|essay|class|quiz|grade|teacher|test)/.test(lower)) {
    if (!schoolEnabled) {
      return {
        reply: `Share the core question in plain words and we'll break it down together. If you want dedicated step-by-step tools, enable School / Student under Industry Context in Character Build.`,
        gesture: "curious_brow",
        voiceTone: "warm",
      };
    }
    return {
      reply: isProf
        ? `Explain the prompt back to me in one plain sentence without looking at notes—wherever the phrasing hesitates is the exact concept we'll sharpen first.`
        : `Right in our wheelhouse. Start with what the assignment is really asking in plain English, and we'll map it step by step.`,
      gesture: "wink",
      voiceTone: "witty",
    };
  }

  if (/(book|read|novel|story|write|poem|chapter|character|author)/.test(lower)) {
    return {
      reply: isProf
        ? `Every enduring chapter turns on a tension between what a character wants and what they are willing to lose. Which scene or line caught your eye?`
        : `Always up for a good page or story spark. Tell me the scene, line, or idea on your mind and ${name} will dig in with you.`,
      gesture: "wink",
      voiceTone: "witty",
    };
  }

  if (/(friend|mad|fight|argument|lonely|relationship|family|parent|trust)/.test(lower)) {
    return {
      reply: isYouth
        ? `Feelings can get tangled fast, and it's okay to feel hurt or confused. Want to tell me what happened so we can think of kind, clear words together?`
        : `People rarely argue about the surface detail—usually someone feels unheard or cornered. Want to unpack what they said versus what you needed them to hear?`,
      gesture: "concerned_tilt",
      voiceTone: "warm",
    };
  }

  if (/(joke|funny|laugh|smile|cheer|humor)/.test(lower)) {
    return {
      reply: pickVariant([
        `Consider this your reminder from ${name}: even plot twists don't get to write the ending without you. What's one tiny win we can claim right now?`,
        `Why did the overthinker bring a ladder to the library? To reach higher conclusions. Okay, terrible pun—but tell me what's on your mind next!`,
      ]),
      gesture: "laugh",
      voiceTone: "excited",
    };
  }

  if (/(celebrate|excited|won|passed|proud|good news|happy|amazing)/.test(lower)) {
    return {
      reply: isBoss
        ? `Earned. Take two minutes to savor the win, then lock in why it worked so you can repeat it.`
        : `Look at you—${name} never doubted it for a second! Tell me every detail of how it came together.`,
      gesture: "laugh",
      voiceTone: "excited",
    };
  }

  if (lower.includes("?") || /\b(why|how|what|explain|meaning|meaningful)\b/.test(lower)) {
    return {
      reply: isProf
        ? `Good question—let's test it from first principles. What assumption inside that question are you most eager to challenge or unpack?`
        : `Even offline, let's reason through it together: give me the background or what you've ruled out so far so I don't repeat what you already know.`,
      gesture: "curious_brow",
      voiceTone: "calm",
    };
  }

  if (isBoss) {
    return {
      reply: `Heard you. Tell me the outcome you want from this situation and the main blocker standing in front of it.`,
      gesture: "smirk",
      voiceTone: "witty",
    };
  }
  if (isProf) {
    return {
      reply: `Interesting thread—say a bit more about what draws your attention here, and let's examine the strongest angle on it.`,
      gesture: "curious_brow",
      voiceTone: "calm",
    };
  }
  return {
    reply: isYouth
      ? `I'm listening right alongside you! Tell me a little more about that so ${name} can jump in with you.`
      : `I'm right beside you (${callName} active in offline mode). Tell me a bit more context and we'll figure out the cleanest move together.`,
    gesture: "thumbs_up",
    voiceTone: identity.voiceTone,
  };
}
