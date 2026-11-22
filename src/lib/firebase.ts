import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";
import {
  DEFAULT_BACKGROUND_SPEC,
  DEFAULT_COMPANION_IDENTITY,
  DEFAULT_GUARDIAN_PROFILE,
  DEFAULT_MUSIC_SPEC,
  type ActivityLogItem,
  type BackgroundSpec,
  type CompanionIdentity,
  type JournalEntry,
  type MusicSpec,
  type StoryRecord,
  type UserGuardianProfile,
} from "../types/kith";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration: client is offline.");
      return false;
    }
    return true;
  }
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Local offline cache helpers (also supports guest/offline continuity)
const LOCAL_KEYS = {
  companion: "kith_studio_companion_v1",
  guardian: "kith_studio_guardian_v1",
  journals: "kith_studio_journals_v1",
  stories: "kith_studio_stories_v1",
  activity: "kith_studio_activity_v1",
};

export function loadLocalCompanion(): CompanionIdentity {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.companion);
    if (!raw) return DEFAULT_COMPANION_IDENTITY;
    return { ...DEFAULT_COMPANION_IDENTITY, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COMPANION_IDENTITY;
  }
}

export function saveLocalCompanion(identity: CompanionIdentity): void {
  try {
    localStorage.setItem(LOCAL_KEYS.companion, JSON.stringify(identity));
  } catch {
    // ignore storage quota
  }
}

export function loadLocalGuardian(): UserGuardianProfile {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.guardian);
    if (!raw) return DEFAULT_GUARDIAN_PROFILE;
    return { ...DEFAULT_GUARDIAN_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_GUARDIAN_PROFILE;
  }
}

export function saveLocalGuardian(profile: UserGuardianProfile): void {
  try {
    localStorage.setItem(LOCAL_KEYS.guardian, JSON.stringify(profile));
  } catch {
    // ignore
  }
}

export function loadLocalJournals(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.journals);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalJournals(entries: JournalEntry[]): void {
  try {
    localStorage.setItem(LOCAL_KEYS.journals, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

export function loadLocalStories(): StoryRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.stories);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalStories(stories: StoryRecord[]): void {
  try {
    localStorage.setItem(LOCAL_KEYS.stories, JSON.stringify(stories));
  } catch {
    // ignore
  }
}

export function loadLocalActivity(): ActivityLogItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS.activity);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalActivity(items: ActivityLogItem[]): void {
  try {
    localStorage.setItem(LOCAL_KEYS.activity, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function isoFromTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === "string") return val;
  return new Date().toISOString();
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "default";
}

// Firestore persistence operations matching firebase-blueprint.json & firestore.rules
export async function syncUserProfileToFirestore(
  user: User,
  profile: UserGuardianProfile
): Promise<void> {
  const path = `users/${user.uid}`;
  const docRef = doc(db, "users", user.uid);
  try {
    const payload = {
      uid: user.uid,
      displayName: (profile.displayName || user.displayName || "Reader").slice(0, 80),
      ageTier: profile.ageTier,
      guardianPinEnabled: Boolean(profile.guardianPinEnabled),
      dailyLimitMinutes: Math.max(10, Math.min(480, Math.round(profile.dailyLimitMinutes))),
      minutesUsedToday: Math.max(0, Math.min(1440, Math.round(profile.minutesUsedToday))),
      lockScreenMoodPhrase: (profile.lockScreenMoodPhrase || "").slice(0, 160),
      updatedAt: serverTimestamp(),
    };
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserProfileFromFirestore(
  user: User
): Promise<UserGuardianProfile | null> {
  const path = `users/${user.uid}`;
  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      displayName: String(d.displayName || user.displayName || "Reader"),
      ageTier: (d.ageTier as UserGuardianProfile["ageTier"]) || "teen",
      guardianPinEnabled: Boolean(d.guardianPinEnabled),
      dailyLimitMinutes: Number(d.dailyLimitMinutes ?? 90),
      minutesUsedToday: Number(d.minutesUsedToday ?? 0),
      lockScreenMoodPhrase: String(d.lockScreenMoodPhrase || DEFAULT_GUARDIAN_PROFILE.lockScreenMoodPhrase),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

function normalizeHex(hex: unknown, fallback: string): string {
  if (typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex.trim())) {
    return hex.trim().toUpperCase();
  }
  return fallback;
}

function sanitizeBackgroundSpec(spec?: BackgroundSpec): BackgroundSpec {
  const src = spec || DEFAULT_BACKGROUND_SPEC;
  const allowedThemes = [
    "minimal",
    "library",
    "rainy_cafe",
    "observatory",
    "music_lounge",
    "outdoor_coast",
    "city",
    "river_boat",
    "jungle",
    "pyramid",
    "mars",
  ] as const;
  const allowedMotifs = ["none", "motes", "rain", "stars", "fireflies"] as const;
  return {
    title: (src.title || DEFAULT_BACKGROUND_SPEC.title).trim().slice(0, 80) || "Atelier Studio",
    description: (src.description || "").trim().slice(0, 240),
    skyTopHex: normalizeHex(src.skyTopHex, DEFAULT_BACKGROUND_SPEC.skyTopHex),
    skyBottomHex: normalizeHex(src.skyBottomHex, DEFAULT_BACKGROUND_SPEC.skyBottomHex),
    fogHex: normalizeHex(src.fogHex, DEFAULT_BACKGROUND_SPEC.fogHex),
    keyLightHex: normalizeHex(src.keyLightHex, DEFAULT_BACKGROUND_SPEC.keyLightHex),
    rimLightHex: normalizeHex(src.rimLightHex, DEFAULT_BACKGROUND_SPEC.rimLightHex),
    propTheme: allowedThemes.includes(src.propTheme) ? src.propTheme : "minimal",
    ambientMotif: allowedMotifs.includes(src.ambientMotif) ? src.ambientMotif : "none",
  };
}

function sanitizeMusicSpec(spec?: MusicSpec): MusicSpec {
  const src = spec || DEFAULT_MUSIC_SPEC;
  const genres = ["classic", "pop", "rap", "country", "electronic", "instrumental"] as const;
  const scales = ["major", "minor", "dorian", "pentatonic_major", "pentatonic_minor"] as const;
  const leads = ["piano", "strings", "acoustic_guitar", "synth_pluck", "warm_pad", "flute"] as const;
  const basses = ["none", "cello_drone", "sub_808", "synth_pulse", "country_root_fifth", "walking_bass"] as const;
  const drums = ["none", "boom_bap", "pop_groove", "country_brush", "electronic_pulse", "soft_ambient"] as const;

  const cleanChords = Array.isArray(src.chords)
    ? src.chords
        .map((c) => Math.max(0, Math.min(6, Math.round(Number(c) || 0))))
        .slice(0, 8)
    : [];
  const cleanMelody = Array.isArray(src.melody)
    ? src.melody
        .map((m) => Math.max(-1, Math.min(14, Math.round(Number.isFinite(Number(m)) ? Number(m) : -1))))
        .slice(0, 32)
    : [];

  return {
    title: (src.title || DEFAULT_MUSIC_SPEC.title).trim().slice(0, 80) || "Custom Soundtrack",
    description: (src.description || "").trim().slice(0, 240),
    genre: genres.includes(src.genre) ? src.genre : "classic",
    bpm: Math.max(45, Math.min(170, Math.round(Number(src.bpm) || 76))),
    rootMidi: Math.max(45, Math.min(72, Math.round(Number(src.rootMidi) || 60))),
    scaleMode: scales.includes(src.scaleMode) ? src.scaleMode : "minor",
    chords: cleanChords.length > 0 ? cleanChords : DEFAULT_MUSIC_SPEC.chords,
    melody: cleanMelody.length > 0 ? cleanMelody : DEFAULT_MUSIC_SPEC.melody,
    leadInstrument: leads.includes(src.leadInstrument) ? src.leadInstrument : "piano",
    bassStyle: basses.includes(src.bassStyle) ? src.bassStyle : "cello_drone",
    drumPattern: drums.includes(src.drumPattern) ? src.drumPattern : "none",
    brightness: Math.max(10, Math.min(100, Math.round(Number(src.brightness) || 60))),
    swing: Math.max(0, Math.min(40, Math.round(Number(src.swing) || 0))),
  };
}

export async function saveCompanionToFirestore(
  userId: string,
  identity: CompanionIdentity
): Promise<void> {
  const path = `users/${userId}/companions/primary`;
  const docRef = doc(db, "users", userId, "companions", "primary");
  try {
    const existingSnap = await getDoc(docRef);
    const cleanedNicknames = identity.nicknames
      .map((n) => n.trim().slice(0, 32))
      .filter(Boolean)
      .slice(0, 10);

    const basePayload = {
      ownerId: userId,
      studioName: (identity.studioName?.trim() || "Kith Studios").slice(0, 60),
      gender: identity.gender || "masculine",
      lifeFocus: identity.lifeFocus || "general",
      selectedIndustry: identity.selectedIndustry || "NONE",
      enabledIndustryModules: Array.isArray(identity.enabledIndustryModules)
        ? identity.enabledIndustryModules
            .map((m) => String(m).trim().slice(0, 32))
            .filter(Boolean)
            .slice(0, 10)
        : [],
      otherIndustryName: (identity.otherIndustryName || "").trim().slice(0, 100),
      userAgeBand: identity.userAgeBand || "11-20",
      maturityMode: identity.maturityMode === "timeless" ? "timeless" : "maturing",
      adaptiveSelfTuning: identity.adaptiveSelfTuning !== false,
      characterBuildNote: (identity.characterBuildNote || "").trim().slice(0, 240),
      primaryName: (identity.primaryName.trim() || "Julian").slice(0, 48),
      letHimChoose: Boolean(identity.letHimChoose),
      nicknames: cleanedNicknames,
      activeNickname: (identity.activeNickname || "").trim().slice(0, 32),
      archetype: identity.archetype,
      decadeStage: Math.max(0, Math.min(3, Math.round(identity.decadeStage))),
      coatLayering: Math.max(0, Math.min(100, Math.round(identity.coatLayering))),
      hairLength: Math.max(0, Math.min(100, Math.round(identity.hairLength))),
      accessoryDetail: Math.max(0, Math.min(100, Math.round(identity.accessoryDetail))),
      warmthHumor: Math.max(0, Math.min(100, Math.round(identity.warmthHumor))),
      scholarlyDepth: Math.max(0, Math.min(100, Math.round(identity.scholarlyDepth))),
      voiceTone: identity.voiceTone,
      cameraFraming:
        identity.cameraFraming === "headshot" ||
        identity.cameraFraming === "half_body" ||
        identity.cameraFraming === "full_body"
          ? identity.cameraFraming
          : "half_body",
      backgroundPreset: identity.backgroundPreset || "studio_plinth",
      backgroundPrompt: (identity.backgroundPrompt || "").trim().slice(0, 240),
      backgroundSpec: sanitizeBackgroundSpec(identity.backgroundSpec),
      voiceSource: identity.voiceSource || "suggested",
      voicePresetId: (identity.voicePresetId || "").trim().slice(0, 40),
      voiceStylePrompt: (identity.voiceStylePrompt || "").trim().slice(0, 240),
      voiceExternalUrl: (identity.voiceExternalUrl || "").trim().slice(0, 300),
      voiceSampleLabel: (identity.voiceSampleLabel || "").trim().slice(0, 100),
      voiceAutoSpeak: Boolean(identity.voiceAutoSpeak),
      musicEnabled: Boolean(identity.musicEnabled),
      musicVolume: Math.max(0, Math.min(100, Math.round(Number(identity.musicVolume ?? 42)))),
      musicPreset: identity.musicPreset || "none",
      musicPrompt: (identity.musicPrompt || "").trim().slice(0, 240),
      musicSpec: sanitizeMusicSpec(identity.musicSpec),
      updatedAt: serverTimestamp(),
    };

    if (!existingSnap.exists()) {
      await setDoc(docRef, { ...basePayload, createdAt: serverTimestamp() });
    } else {
      await setDoc(
        docRef,
        {
          ...basePayload,
          createdAt: existingSnap.data().createdAt,
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCompanionFromFirestore(
  userId: string
): Promise<CompanionIdentity | null> {
  const path = `users/${userId}/companions/primary`;
  try {
    const snap = await getDoc(doc(db, "users", userId, "companions", "primary"));
    if (!snap.exists()) return null;
    const d = snap.data();
    return {
      studioName: String(d.studioName || "Kith Studios"),
      gender: (d.gender as CompanionIdentity["gender"]) || "masculine",
      lifeFocus: (d.lifeFocus as CompanionIdentity["lifeFocus"]) || "general",
      selectedIndustry:
        (d.selectedIndustry as CompanionIdentity["selectedIndustry"]) || "NONE",
      enabledIndustryModules: Array.isArray(d.enabledIndustryModules)
        ? d.enabledIndustryModules.map(String)
        : [],
      otherIndustryName: String(d.otherIndustryName || ""),
      userAgeBand: (d.userAgeBand as CompanionIdentity["userAgeBand"]) || "11-20",
      maturityMode: d.maturityMode === "timeless" ? "timeless" : "maturing",
      adaptiveSelfTuning: d.adaptiveSelfTuning === undefined ? true : Boolean(d.adaptiveSelfTuning),
      characterBuildNote: String(d.characterBuildNote || ""),
      primaryName: String(d.primaryName || "Julian"),
      letHimChoose: Boolean(d.letHimChoose),
      nicknames: Array.isArray(d.nicknames) ? d.nicknames.map(String) : ["Jules"],
      activeNickname: String(d.activeNickname || ""),
      archetype: d.archetype || "classic_scholar",
      decadeStage: Number(d.decadeStage ?? 0),
      coatLayering: Number(d.coatLayering ?? 68),
      hairLength: Number(d.hairLength ?? 42),
      accessoryDetail: Number(d.accessoryDetail ?? 62),
      warmthHumor: Number(d.warmthHumor ?? 84),
      scholarlyDepth: Number(d.scholarlyDepth ?? 95),
      voiceTone: d.voiceTone || "warm",
      cameraFraming:
        d.cameraFraming === "headshot" ||
        d.cameraFraming === "half_body" ||
        d.cameraFraming === "full_body"
          ? d.cameraFraming
          : "half_body",
      backgroundPreset:
        (d.backgroundPreset as CompanionIdentity["backgroundPreset"]) ||
        "studio_plinth",
      backgroundPrompt: String(d.backgroundPrompt || ""),
      backgroundSpec: d.backgroundSpec
        ? sanitizeBackgroundSpec(d.backgroundSpec as BackgroundSpec)
        : DEFAULT_BACKGROUND_SPEC,
      voiceSource:
        (d.voiceSource as CompanionIdentity["voiceSource"]) || "suggested",
      voicePresetId: String(d.voicePresetId || "Charon"),
      voiceStylePrompt: String(d.voiceStylePrompt || ""),
      voiceExternalUrl: String(d.voiceExternalUrl || ""),
      voiceSampleLabel: String(d.voiceSampleLabel || ""),
      voiceAutoSpeak: Boolean(d.voiceAutoSpeak),
      musicEnabled: Boolean(d.musicEnabled),
      musicVolume: Number.isFinite(Number(d.musicVolume))
        ? Math.max(0, Math.min(100, Math.round(Number(d.musicVolume))))
        : 42,
      musicPreset:
        (d.musicPreset as CompanionIdentity["musicPreset"]) || "none",
      musicPrompt: String(d.musicPrompt || ""),
      musicSpec: d.musicSpec
        ? sanitizeMusicSpec(d.musicSpec as MusicSpec)
        : DEFAULT_MUSIC_SPEC,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveJournalToFirestore(
  userId: string,
  entry: JournalEntry
): Promise<void> {
  const safeId = sanitizeId(entry.id);
  const path = `users/${userId}/journals/${safeId}`;
  const docRef = doc(db, "users", userId, "journals", safeId);
  try {
    const existingSnap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      ownerId: userId,
      title: (entry.title.trim() || "Journal Entry").slice(0, 140),
      content: entry.content.slice(0, 6000),
      mood: (entry.mood || "reflective").slice(0, 40),
      updatedAt: serverTimestamp(),
    };
    if (entry.companionReflection) {
      payload.companionReflection = entry.companionReflection.slice(0, 2000);
    }
    if (entry.artSvg) {
      payload.artSvg = entry.artSvg.slice(0, 45000);
    }
    if (entry.artCaption) {
      payload.artCaption = entry.artCaption.slice(0, 240);
    }
    if (!existingSnap.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(docRef, payload);
    } else {
      payload.createdAt = existingSnap.data().createdAt;
      await setDoc(docRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteJournalFromFirestore(
  userId: string,
  entryId: string
): Promise<void> {
  const safeId = sanitizeId(entryId);
  const path = `users/${userId}/journals/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "journals", safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchJournalsFromFirestore(
  userId: string
): Promise<JournalEntry[]> {
  const path = `users/${userId}/journals`;
  try {
    const q = query(
      collection(db, "users", userId, "journals"),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        title: String(d.title || "Untitled"),
        content: String(d.content || ""),
        mood: String(d.mood || "reflective"),
        companionReflection: d.companionReflection ? String(d.companionReflection) : undefined,
        artSvg: d.artSvg ? String(d.artSvg) : undefined,
        artCaption: d.artCaption ? String(d.artCaption) : undefined,
        createdAtIso: isoFromTimestamp(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function saveStoryToFirestore(
  userId: string,
  story: StoryRecord
): Promise<void> {
  const safeId = sanitizeId(story.id);
  const path = `users/${userId}/stories/${safeId}`;
  const docRef = doc(db, "users", userId, "stories", safeId);
  try {
    const existingSnap = await getDoc(docRef);
    const payload: Record<string, unknown> = {
      ownerId: userId,
      title: (story.title || "Adventure").slice(0, 140),
      theme: (story.theme || "Hidden Library").slice(0, 120),
      summary: story.summary.slice(0, 4000),
      updatedAt: serverTimestamp(),
    };
    if (!existingSnap.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(docRef, payload);
    } else {
      payload.createdAt = existingSnap.data().createdAt;
      await setDoc(docRef, payload, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchStoriesFromFirestore(userId: string): Promise<StoryRecord[]> {
  const path = `users/${userId}/stories`;
  try {
    const q = query(
      collection(db, "users", userId, "stories"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        title: String(d.title || "Story"),
        theme: String(d.theme || ""),
        summary: String(d.summary || ""),
        createdAtIso: isoFromTimestamp(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function logActivityToFirestore(
  userId: string,
  item: ActivityLogItem
): Promise<void> {
  const safeId = sanitizeId(item.id);
  const path = `users/${userId}/activity/${safeId}`;
  try {
    await setDoc(doc(db, "users", userId, "activity", safeId), {
      ownerId: userId,
      mode: item.mode,
      summary: item.summary.slice(0, 240),
      durationMinutes: Math.max(0, Math.min(480, Math.round(item.durationMinutes))),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchActivityFromFirestore(
  userId: string
): Promise<ActivityLogItem[]> {
  const path = `users/${userId}/activity`;
  try {
    const q = query(
      collection(db, "users", userId, "activity"),
      orderBy("createdAt", "desc"),
      limit(25)
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        mode: d.mode,
        summary: String(d.summary || ""),
        durationMinutes: Number(d.durationMinutes ?? 1),
        createdAtIso: isoFromTimestamp(d.createdAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
