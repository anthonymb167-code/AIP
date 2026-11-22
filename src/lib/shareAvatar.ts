import {
  AGE_BAND_ORDER,
  ARCHETYPES,
  BACKGROUND_PRESETS,
  DEFAULT_COMPANION_IDENTITY,
  GENDER_OPTIONS,
  INDUSTRY_ORDER,
  LIFE_FOCUS_OPTIONS,
  type AgeBandId,
  type ArchetypeId,
  type AvatarFraming,
  type BackgroundPresetId,
  type CompanionGender,
  type CompanionIdentity,
  type IndustryId,
  type LifeFocusId,
  type MusicPresetId,
  type VoiceTone,
} from "../types/kith";

const SHARE_HASH_PREFIX = "#a=";

interface CompactSharedBuild {
  v: 1;
  sn?: string;
  pn?: string;
  an?: string;
  n?: string[];
  g?: CompanionGender;
  lf?: LifeFocusId;
  si?: IndustryId;
  em?: string[];
  oi?: string;
  ab?: AgeBandId;
  mm?: "timeless" | "maturing";
  ad?: boolean;
  cb?: string;
  ar?: ArchetypeId;
  ds?: number;
  cl?: number;
  hl?: number;
  ac?: number;
  wh?: number;
  sd?: number;
  vt?: VoiceTone;
  vp?: number;
  cf?: AvatarFraming;
  bp?: BackgroundPresetId;
  bq?: string;
  mp?: MusicPresetId;
}

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + "=".repeat(padLen);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function encodeShareIdentity(identity: CompanionIdentity): string {
  const payload: CompactSharedBuild = {
    v: 1,
    sn: identity.studioName.slice(0, 60),
    pn: identity.primaryName.slice(0, 48),
    an: identity.activeNickname.slice(0, 32),
    n: identity.nicknames.slice(0, 6).map((x) => x.slice(0, 32)),
    g: identity.gender,
    lf: identity.lifeFocus,
    si: identity.selectedIndustry || "NONE",
    em: (identity.enabledIndustryModules || []).slice(0, 8),
    oi: (identity.otherIndustryName || "").slice(0, 100),
    ab: identity.userAgeBand || "11-20",
    mm: identity.maturityMode === "timeless" ? "timeless" : "maturing",
    ad: identity.adaptiveSelfTuning !== false,
    cb: (identity.characterBuildNote || "").slice(0, 180),
    ar: identity.archetype,
    ds: clampInt(identity.decadeStage, 0, 3, 0),
    cl: clampInt(identity.coatLayering, 0, 100, 68),
    hl: clampInt(identity.hairLength, 0, 100, 42),
    ac: clampInt(identity.accessoryDetail, 0, 100, 62),
    wh: clampInt(identity.warmthHumor, 0, 100, 84),
    sd: clampInt(identity.scholarlyDepth, 0, 100, 95),
    vt: identity.voiceTone,
    vp: typeof identity.voicePitch === "number" ? Number(identity.voicePitch.toFixed(2)) : undefined,
    cf: identity.cameraFraming || "half_body",
    bp: identity.backgroundPreset || "studio_plinth",
    bq: (identity.backgroundPrompt || "").slice(0, 160),
    mp: identity.musicPreset || "none",
  };
  return `${SHARE_HASH_PREFIX}${toBase64Url(JSON.stringify(payload))}`;
}

export function encodeShareDataOnly(identity: CompanionIdentity): string {
  return encodeShareIdentity(identity).replace(/^#a=/, "");
}

export function buildShareUrl(identity: CompanionIdentity): string {
  if (typeof window === "undefined") {
    return encodeShareIdentity(identity);
  }
  return `${window.location.origin}${window.location.pathname}${encodeShareIdentity(identity)}`;
}

export function areIdentitiesShareEqual(
  a: CompanionIdentity,
  b: CompanionIdentity
): boolean {
  return encodeShareDataOnly(a) === encodeShareDataOnly(b);
}

export function isAvatarCustomized(identity: CompanionIdentity): boolean {
  let changes = 0;
  if (identity.archetype !== DEFAULT_COMPANION_IDENTITY.archetype) changes += 1;
  if (identity.activeNickname !== DEFAULT_COMPANION_IDENTITY.activeNickname) changes += 1;
  if (identity.gender !== DEFAULT_COMPANION_IDENTITY.gender) changes += 1;
  if (identity.primaryName !== DEFAULT_COMPANION_IDENTITY.primaryName) changes += 1;
  if (identity.userAgeBand !== DEFAULT_COMPANION_IDENTITY.userAgeBand) changes += 1;
  if (identity.selectedIndustry !== DEFAULT_COMPANION_IDENTITY.selectedIndustry) changes += 1;
  if ((identity.enabledIndustryModules || []).length > 0) changes += 1;
  if (identity.coatLayering !== DEFAULT_COMPANION_IDENTITY.coatLayering) changes += 1;
  if (identity.hairLength !== DEFAULT_COMPANION_IDENTITY.hairLength) changes += 1;
  if (identity.accessoryDetail !== DEFAULT_COMPANION_IDENTITY.accessoryDetail) changes += 1;
  if (identity.warmthHumor !== DEFAULT_COMPANION_IDENTITY.warmthHumor) changes += 1;
  if (identity.scholarlyDepth !== DEFAULT_COMPANION_IDENTITY.scholarlyDepth) changes += 1;
  if ((identity.cameraFraming || "half_body") !== DEFAULT_COMPANION_IDENTITY.cameraFraming) {
    changes += 1;
  }
  if ((identity.backgroundPreset || "studio_plinth") !== "studio_plinth") changes += 1;
  if ((identity.musicPreset || "none") !== "none") changes += 1;
  return changes >= 2;
}

export function decodeShareHash(
  hash: string
): { identity: CompanionIdentity; summary: string } | null {
  if (!hash || !hash.startsWith(SHARE_HASH_PREFIX)) {
    return null;
  }
  const encoded = hash.slice(SHARE_HASH_PREFIX.length).trim();
  if (!encoded || encoded.length > 4096) {
    return null;
  }
  try {
    const raw = JSON.parse(fromBase64Url(encoded)) as Partial<CompactSharedBuild>;
    if (!raw || typeof raw !== "object" || raw.v !== 1) {
      return null;
    }

    const validGender = GENDER_OPTIONS.some((g) => g.id === raw.g)
      ? (raw.g as CompanionGender)
      : DEFAULT_COMPANION_IDENTITY.gender;

    const validArchetype =
      raw.ar && Object.prototype.hasOwnProperty.call(ARCHETYPES, raw.ar)
        ? (raw.ar as ArchetypeId)
        : DEFAULT_COMPANION_IDENTITY.archetype;

    const validAgeBand =
      raw.ab && AGE_BAND_ORDER.includes(raw.ab)
        ? (raw.ab as AgeBandId)
        : DEFAULT_COMPANION_IDENTITY.userAgeBand;

    const validIndustry =
      raw.si && INDUSTRY_ORDER.includes(raw.si)
        ? (raw.si as IndustryId)
        : "NONE";

    const validLifeFocus =
      raw.lf && LIFE_FOCUS_OPTIONS.some((l) => l.id === raw.lf)
        ? (raw.lf as LifeFocusId)
        : "general";

    const validTones: VoiceTone[] = ["warm", "excited", "calm", "witty"];
    const validTone =
      raw.vt && validTones.includes(raw.vt)
        ? raw.vt
        : DEFAULT_COMPANION_IDENTITY.voiceTone;

    const validFramings: AvatarFraming[] = ["headshot", "half_body", "full_body"];
    const validFraming =
      raw.cf && validFramings.includes(raw.cf) ? raw.cf : "half_body";

    const rawBg = typeof raw.bp === "string" ? raw.bp.trim() : "studio_plinth";
    const validBgPreset: BackgroundPresetId =
      rawBg === "custom" || Object.prototype.hasOwnProperty.call(BACKGROUND_PRESETS, rawBg)
        ? (rawBg as BackgroundPresetId)
        : "studio_plinth";
    const resolvedBgSpec =
      validBgPreset !== "custom"
        ? BACKGROUND_PRESETS[validBgPreset]
        : DEFAULT_COMPANION_IDENTITY.backgroundSpec;

    const primaryName =
      typeof raw.pn === "string" && raw.pn.trim()
        ? raw.pn.trim().slice(0, 48)
        : ARCHETYPES[validArchetype].selfChosenNameByGender[validGender];

    const nicknames = Array.isArray(raw.n)
      ? raw.n
          .map((x) => String(x).trim().slice(0, 32))
          .filter(Boolean)
          .slice(0, 10)
      : ARCHETYPES[validArchetype].defaultNicknames;

    const nextIdentity: CompanionIdentity = {
      ...DEFAULT_COMPANION_IDENTITY,
      studioName:
        typeof raw.sn === "string" && raw.sn.trim()
          ? raw.sn.trim().slice(0, 60)
          : DEFAULT_COMPANION_IDENTITY.studioName,
      primaryName,
      activeNickname:
        typeof raw.an === "string" ? raw.an.trim().slice(0, 32) : nicknames[0] || "",
      nicknames,
      gender: validGender,
      lifeFocus: validLifeFocus,
      selectedIndustry: validIndustry,
      enabledIndustryModules: Array.isArray(raw.em)
        ? raw.em.map((m) => String(m).trim().slice(0, 32)).filter(Boolean).slice(0, 8)
        : [],
      otherIndustryName:
        typeof raw.oi === "string" ? raw.oi.trim().slice(0, 100) : "",
      userAgeBand: validAgeBand,
      maturityMode: raw.mm === "timeless" ? "timeless" : "maturing",
      adaptiveSelfTuning: raw.ad !== false,
      characterBuildNote:
        typeof raw.cb === "string" ? raw.cb.trim().slice(0, 240) : "",
      archetype: validArchetype,
      decadeStage: clampInt(raw.ds, 0, 3, 0),
      coatLayering: clampInt(raw.cl, 0, 100, DEFAULT_COMPANION_IDENTITY.coatLayering),
      hairLength: clampInt(raw.hl, 0, 100, DEFAULT_COMPANION_IDENTITY.hairLength),
      accessoryDetail: clampInt(raw.ac, 0, 100, DEFAULT_COMPANION_IDENTITY.accessoryDetail),
      warmthHumor: clampInt(raw.wh, 0, 100, DEFAULT_COMPANION_IDENTITY.warmthHumor),
      scholarlyDepth: clampInt(raw.sd, 0, 100, DEFAULT_COMPANION_IDENTITY.scholarlyDepth),
      voiceTone: validTone,
      voicePitch:
        typeof raw.vp === "number" && !isNaN(raw.vp)
          ? Math.max(0.6, Math.min(1.4, Number(raw.vp)))
          : DEFAULT_COMPANION_IDENTITY.voicePitch,
      cameraFraming: validFraming,
      backgroundPreset: validBgPreset,
      backgroundPrompt:
        typeof raw.bq === "string" ? raw.bq.trim().slice(0, 240) : "",
      backgroundSpec: resolvedBgSpec,
      musicPreset:
        typeof raw.mp === "string" && raw.mp.trim()
          ? (raw.mp.trim() as MusicPresetId)
          : "none",
    };

    return {
      identity: nextIdentity,
      summary: `${nextIdentity.primaryName} (${ARCHETYPES[validArchetype].shortLabel})`,
    };
  } catch {
    return null;
  }
}
