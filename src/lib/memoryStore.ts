import {
  AGE_BAND_PROFILES,
  ARCHETYPES,
  INDUSTRIES,
  resolvePersonaVoiceSpec,
  type ChatMessage,
  type CompanionIdentity,
  type CompanionMemoryState,
  type FocusWeights,
  type MemoryFact,
  type MemoryFactCategory,
  type MemoryIdentitySeed,
  type MemorySessionSummary,
  type PersonaKey,
} from "../types/kith";

export const MEMORY_SCHEMA_VERSION = 1;
export const MAX_MEMORY_SESSIONS = 20;
export const MAX_MEMORY_FACTS = 40;

export const MEMORY_STORAGE_KEYS = {
  version: "aip_memory_version",
  settings: "aip_memory_settings",
  identity: "aip_memory_identity",
  facts: "aip_memory_facts",
  sessions: "aip_memory_sessions",
} as const;

interface StoredMemorySettings {
  memoryEnabled: boolean;
  proactiveEnabled: boolean;
  lastSessionEndedIso?: string;
}

const DEFAULT_MEMORY_SETTINGS: StoredMemorySettings = {
  memoryEnabled: true,
  proactiveEnabled: true,
};

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw || raw === "undefined" || raw === "null") return fallback;
    const parsed = JSON.parse(raw) as T;
    if (parsed === null || parsed === undefined) return fallback;
    return parsed;
  } catch (err) {
    console.warn(`[memoryStore] Corrupt storage at "${key}", resetting slice:`, err);
    return fallback;
  }
}

function safeWriteJson<T>(key: string, value: T): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.localStorage.setItem(
      MEMORY_STORAGE_KEYS.version,
      String(MEMORY_SCHEMA_VERSION)
    );
    return true;
  } catch (err) {
    console.warn(`[memoryStore] Failed writing "${key}":`, err);
    return false;
  }
}

function readSettings(): StoredMemorySettings {
  const raw = safeReadJson<Partial<StoredMemorySettings>>(
    MEMORY_STORAGE_KEYS.settings,
    DEFAULT_MEMORY_SETTINGS
  );
  if (!raw || typeof raw !== "object") return DEFAULT_MEMORY_SETTINGS;
  const memoryEnabled = raw.memoryEnabled !== false;
  return {
    memoryEnabled,
    proactiveEnabled: memoryEnabled && raw.proactiveEnabled !== false,
    lastSessionEndedIso:
      typeof raw.lastSessionEndedIso === "string"
        ? raw.lastSessionEndedIso
        : undefined,
  };
}

function readIdentitySeed(): MemoryIdentitySeed | null {
  const raw = safeReadJson<Partial<MemoryIdentitySeed> | null>(
    MEMORY_STORAGE_KEYS.identity,
    null
  );
  if (!raw || typeof raw !== "object" || !raw.archetype || !raw.primaryName) {
    return null;
  }
  return {
    archetype: raw.archetype,
    primaryName: String(raw.primaryName),
    ageBand: raw.ageBand || "11-20",
    industry: raw.industry || "NONE",
    lifeFocus: raw.lifeFocus || "general",
    onboardingNote:
      typeof raw.onboardingNote === "string" ? raw.onboardingNote : undefined,
    createdAtIso:
      typeof raw.createdAtIso === "string"
        ? raw.createdAtIso
        : new Date().toISOString(),
  };
}

function readFacts(): MemoryFact[] {
  const raw = safeReadJson<unknown>(MEMORY_STORAGE_KEYS.facts, []);
  if (!Array.isArray(raw)) return [];
  const allowedCats = new Set<MemoryFactCategory>([
    "goal",
    "worry",
    "preference",
    "person",
    "project",
  ]);
  return raw
    .filter(
      (f): f is MemoryFact =>
        Boolean(f) &&
        typeof f === "object" &&
        typeof (f as MemoryFact).id === "string" &&
        allowedCats.has((f as MemoryFact).category) &&
        typeof (f as MemoryFact).value === "string" &&
        (f as MemoryFact).value.trim().length > 0
    )
    .slice(0, MAX_MEMORY_FACTS);
}

function readSessions(): MemorySessionSummary[] {
  const raw = safeReadJson<unknown>(MEMORY_STORAGE_KEYS.sessions, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is MemorySessionSummary =>
        Boolean(s) &&
        typeof s === "object" &&
        typeof (s as MemorySessionSummary).id === "string" &&
        typeof (s as MemorySessionSummary).summary === "string" &&
        (s as MemorySessionSummary).summary.trim().length > 0
    )
    .slice(-MAX_MEMORY_SESSIONS);
}

export function getMemoryState(): CompanionMemoryState {
  const settings = readSettings();
  return {
    version: MEMORY_SCHEMA_VERSION,
    memoryEnabled: settings.memoryEnabled,
    proactiveEnabled: settings.memoryEnabled && settings.proactiveEnabled,
    identitySeed: readIdentitySeed(),
    facts: readFacts(),
    sessions: readSessions(),
    lastSessionEndedIso: settings.lastSessionEndedIso,
  };
}

export function setMemorySettings(patch: {
  memoryEnabled?: boolean;
  proactiveEnabled?: boolean;
  lastSessionEndedIso?: string;
}): CompanionMemoryState {
  const current = readSettings();
  const nextMemoryEnabled =
    patch.memoryEnabled !== undefined
      ? patch.memoryEnabled
      : current.memoryEnabled;
  const nextProactiveEnabled = nextMemoryEnabled
    ? patch.proactiveEnabled !== undefined
      ? patch.proactiveEnabled
      : current.proactiveEnabled
    : false;
  const next: StoredMemorySettings = {
    memoryEnabled: nextMemoryEnabled,
    proactiveEnabled: nextProactiveEnabled,
    lastSessionEndedIso:
      patch.lastSessionEndedIso !== undefined
        ? patch.lastSessionEndedIso
        : current.lastSessionEndedIso,
  };
  safeWriteJson(MEMORY_STORAGE_KEYS.settings, next);
  return getMemoryState();
}

export function writeOnboardingIdentityMemory(
  identity: CompanionIdentity,
  onboardingNote?: string
): CompanionMemoryState {
  const settings = readSettings();
  if (!settings.memoryEnabled) return getMemoryState();

  const existingSeed = readIdentitySeed();
  const seed: MemoryIdentitySeed = {
    archetype: identity.archetype,
    primaryName: identity.primaryName || "Julian",
    ageBand: identity.userAgeBand || "11-20",
    industry: identity.selectedIndustry || "NONE",
    lifeFocus: identity.lifeFocus || "general",
    onboardingNote:
      onboardingNote?.trim() ||
      identity.characterBuildNote?.trim() ||
      existingSeed?.onboardingNote,
    createdAtIso: existingSeed?.createdAtIso || new Date().toISOString(),
  };
  safeWriteJson(MEMORY_STORAGE_KEYS.identity, seed);
  return getMemoryState();
}

function normalizeTextForDedup(val: string): string {
  return val
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function areSimilarFacts(a: string, b: string): boolean {
  const na = normalizeTextForDedup(a);
  const nb = normalizeTextForDedup(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 10 && nb.length >= 10 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  const tokensA = new Set(na.split(" ").filter((t) => t.length > 2));
  const tokensB = new Set(nb.split(" ").filter((t) => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return false;
  let overlap = 0;
  tokensA.forEach((t) => {
    if (tokensB.has(t)) overlap += 1;
  });
  return overlap / Math.max(tokensA.size, tokensB.size) >= 0.72;
}

function defaultPersonaRelevance(
  category: MemoryFactCategory,
  activePersona: PersonaKey
): "all" | PersonaKey {
  if (category === "preference") return "all";
  if (category === "worry" || category === "person") {
    return activePersona === "strategist" ? "strategist" : "ally";
  }
  if (category === "goal" || category === "project") {
    return activePersona === "ally" ? "all" : activePersona;
  }
  return "all";
}

export function updateMemoryFacts(
  incomingFacts: Array<{ type: MemoryFactCategory; value: string }>,
  activePersona: PersonaKey = "ally"
): { state: CompanionMemoryState; addedCount: number } {
  const settings = readSettings();
  if (!settings.memoryEnabled || !Array.isArray(incomingFacts)) {
    return { state: getMemoryState(), addedCount: 0 };
  }

  const existing = readFacts();
  let addedCount = 0;
  const nextFacts = [...existing];

  for (const item of incomingFacts) {
    const cleanVal = String(item?.value || "")
      .trim()
      .slice(0, 160);
    if (!cleanVal || cleanVal.length < 3) continue;
    const category: MemoryFactCategory =
      item?.type === "goal" ||
      item?.type === "worry" ||
      item?.type === "preference" ||
      item?.type === "person" ||
      item?.type === "project"
        ? item.type
        : "goal";

    const duplicate = nextFacts.some(
      (f) => f.category === category && areSimilarFacts(f.value, cleanVal)
    );
    if (duplicate) continue;

    nextFacts.unshift({
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      value: cleanVal,
      personaRelevance: defaultPersonaRelevance(category, activePersona),
      createdAtIso: new Date().toISOString(),
    });
    addedCount += 1;
  }

  if (addedCount > 0) {
    safeWriteJson(MEMORY_STORAGE_KEYS.facts, nextFacts.slice(0, MAX_MEMORY_FACTS));
  }
  return { state: getMemoryState(), addedCount };
}

export function addManualMemoryFact(
  category: MemoryFactCategory,
  value: string,
  personaRelevance: "all" | PersonaKey = "all"
): CompanionMemoryState {
  const clean = value.trim().slice(0, 160);
  if (!clean) return getMemoryState();
  const existing = readFacts();
  const duplicate = existing.some(
    (f) => f.category === category && areSimilarFacts(f.value, clean)
  );
  if (duplicate) return getMemoryState();

  const next: MemoryFact[] = [
    {
      id: `fact_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      category,
      value: clean,
      personaRelevance,
      createdAtIso: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, MAX_MEMORY_FACTS);
  safeWriteJson(MEMORY_STORAGE_KEYS.facts, next);
  return getMemoryState();
}

export function deleteMemoryFact(factId: string): CompanionMemoryState {
  const existing = readFacts();
  const next = existing.filter((f) => f.id !== factId);
  safeWriteJson(MEMORY_STORAGE_KEYS.facts, next);
  return getMemoryState();
}

export function addMemorySession(
  session: MemorySessionSummary
): CompanionMemoryState {
  const settings = readSettings();
  if (!settings.memoryEnabled) return getMemoryState();
  if (!session.summary || !session.summary.trim()) return getMemoryState();

  const existing = readSessions();
  const normNew = normalizeTextForDedup(session.summary);
  const filtered = existing.filter((s) => {
    if (s.id === session.id) return false;
    return normalizeTextForDedup(s.summary) !== normNew;
  });

  const cleanSession: MemorySessionSummary = {
    id: session.id,
    dateIso: session.dateIso || new Date().toISOString(),
    personaKey: session.personaKey || "ally",
    personaLabel: session.personaLabel || "Ally",
    summary: session.summary.trim().slice(0, 420),
    topics: (session.topics || [])
      .map((t) => String(t).trim().slice(0, 32))
      .filter(Boolean)
      .slice(0, 4),
    emotionalTone: String(session.emotionalTone || "steady").slice(0, 60),
    openLoops: (session.openLoops || [])
      .map((l) => String(l).trim().slice(0, 140))
      .filter(Boolean)
      .slice(0, 2),
  };

  const nextSessions = [...filtered, cleanSession].slice(-MAX_MEMORY_SESSIONS);
  safeWriteJson(MEMORY_STORAGE_KEYS.sessions, nextSessions);
  setMemorySettings({ lastSessionEndedIso: cleanSession.dateIso });
  return getMemoryState();
}

export function clearAllMemory(): CompanionMemoryState {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(MEMORY_STORAGE_KEYS.identity);
      window.localStorage.removeItem(MEMORY_STORAGE_KEYS.facts);
      window.localStorage.removeItem(MEMORY_STORAGE_KEYS.sessions);
    } catch {
      // ignore storage errors
    }
  }
  return getMemoryState();
}

export function getMemorySizeBytes(): number {
  if (typeof window === "undefined") return 0;
  try {
    let total = 0;
    for (const key of Object.values(MEMORY_STORAGE_KEYS)) {
      const val = window.localStorage.getItem(key);
      if (val) {
        total += new TextEncoder().encode(val).length;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export function exportMemoryJson(): string {
  return JSON.stringify(getMemoryState(), null, 2);
}

export function computeFocusSalience(
  weights: FocusWeights
): MemoryFactCategory[] {
  if (weights.intellect >= weights.trust && weights.intellect >= weights.attunement) {
    return ["project", "goal", "preference", "worry", "person"];
  }
  if (weights.attunement >= 24 || weights.trust >= 40) {
    return ["worry", "person", "preference", "goal", "project"];
  }
  return ["goal", "preference", "worry", "project", "person"];
}

export function buildMemoryContext(
  personaKey: PersonaKey,
  weights: FocusWeights,
  state?: CompanionMemoryState
): {
  hasMemory: boolean;
  contextText: string;
  activeOpenLoops: string[];
} {
  const mem = state || getMemoryState();
  if (!mem.memoryEnabled) {
    return { hasMemory: false, contextText: "", activeOpenLoops: [] };
  }

  const lines: string[] = [];

  if (mem.identitySeed) {
    const archLabel =
      ARCHETYPES[mem.identitySeed.archetype]?.shortLabel ||
      mem.identitySeed.archetype;
    const indLabel =
      INDUSTRIES[mem.identitySeed.industry]?.label || mem.identitySeed.industry;
    const ageLabel =
      AGE_BAND_PROFILES[mem.identitySeed.ageBand]?.shortLabel ||
      mem.identitySeed.ageBand;
    const notePart = mem.identitySeed.onboardingNote
      ? ` User note: "${mem.identitySeed.onboardingNote}".`
      : "";
    lines.push(
      `Identity context: ${mem.identitySeed.primaryName} (${archLabel}, age band ${ageLabel}, context: ${indLabel}).${notePart}`
    );
  }

  // Salience-weighted + persona-filtered facts
  const priorityOrder = computeFocusSalience(weights);
  const visibleFacts = mem.facts
    .filter((f) => {
      if (f.personaRelevance === "all" || f.personaRelevance === personaKey) {
        return true;
      }
      // Persona isolation: Strategist & Scholar do not read raw vulnerable worries logged for Ally
      if (personaKey !== "ally" && f.category === "worry") {
        return false;
      }
      return personaKey === "ally";
    })
    .sort((a, b) => {
      const rankA = priorityOrder.indexOf(a.category);
      const rankB = priorityOrder.indexOf(b.category);
      return (rankA === -1 ? 99 : rankA) - (rankB === -1 ? 99 : rankB);
    })
    .slice(0, 6);

  if (visibleFacts.length > 0) {
    lines.push(
      `Known user details: ${visibleFacts
        .map((f) => `[${f.category}] ${f.value}`)
        .join("; ")}.`
    );
  }

  // Relevant recent sessions (own persona prioritized + optional subtle cross-persona signal)
  const ownSessions = mem.sessions
    .filter((s) => s.personaKey === personaKey)
    .slice(-3);
  const crossSessions = mem.sessions
    .filter((s) => s.personaKey !== personaKey)
    .slice(-1);

  const selectedSessions =
    ownSessions.length > 0 ? ownSessions : mem.sessions.slice(-2);

  if (selectedSessions.length > 0) {
    const summaryStr = selectedSessions
      .map((s) => {
        const day = s.dateIso.slice(0, 10);
        return `(${day}, ${s.personaLabel}) ${s.summary}`;
      })
      .join(" | ");
    lines.push(`Recent sessions: ${summaryStr}`);
  }

  if (ownSessions.length > 0 && crossSessions.length > 0) {
    const c = crossSessions[0];
    lines.push(
      `Cross-persona context (high-level only): User recently spoke with ${c.personaLabel} about ${
        c.topics.join(", ") || "general life"
      } (emotional arc: ${c.emotionalTone}).`
    );
  }

  const openLoops = Array.from(
    new Set(
      mem.sessions
        .slice(-5)
        .filter((s) => s.personaKey === personaKey || personaKey === "ally")
        .flatMap((s) => s.openLoops || [])
        .filter(Boolean)
    )
  ).slice(0, 3);

  if (openLoops.length > 0) {
    lines.push(`Open follow-up threads: ${openLoops.join("; ")}.`);
  }

  // Hard cap to prevent prompt bloat (~1400 chars max)
  let contextText = lines.join("\n");
  if (contextText.length > 1400) {
    contextText = `${contextText.slice(0, 1397)}...`;
  }

  const hasMeaningfulMemory =
    visibleFacts.length > 0 ||
    mem.sessions.length > 0 ||
    Boolean(mem.identitySeed?.onboardingNote);

  return {
    hasMemory: hasMeaningfulMemory && contextText.length > 0,
    contextText,
    activeOpenLoops: openLoops,
  };
}

export function extractLocalMemoryFallback(
  messages: ChatMessage[],
  identity: CompanionIdentity
): {
  session: MemorySessionSummary | null;
  facts: Array<{ type: MemoryFactCategory; value: string }>;
} {
  const userMsgs = messages.filter(
    (m) => m.role === "user" && m.text.trim().length > 2
  );
  if (userMsgs.length === 0) {
    return { session: null, facts: [] };
  }

  const persona = resolvePersonaVoiceSpec(
    identity.activeNickname,
    identity.primaryName
  );
  const facts: Array<{ type: MemoryFactCategory; value: string }> = [];
  const openLoops: string[] = [];
  const topics = new Set<string>();

  for (const m of userMsgs) {
    const text = m.text.trim();
    const lower = text.toLowerCase();

    if (/(job|career|offer|interview|meeting|boss|work|project)/.test(lower)) {
      topics.add("career");
    }
    if (/(stress|worried|anxious|overwhelm|scared|nervous)/.test(lower)) {
      topics.add("mindset");
    }
    if (/(homework|essay|exam|study|book|read|learn|code|debug)/.test(lower)) {
      topics.add("learning");
    }
    if (/(friend|sister|brother|mom|dad|partner|family)/.test(lower)) {
      topics.add("relationships");
    }

    if (
      /(prefer short|like short|short answers|concise|brief|step by step|dont lecture|no jargon)/.test(
        lower
      )
    ) {
      facts.push({ type: "preference", value: text.slice(0, 110) });
    } else if (/(stressed about|worried about|nervous about|anxious about)/.test(lower)) {
      facts.push({ type: "worry", value: text.slice(0, 110) });
      openLoops.push(`Check in on: ${text.slice(0, 80)}`);
    } else if (/(working on|building|trying to finish|goal is|deciding whether|interview on|meeting on)/.test(lower)) {
      facts.push({ type: "goal", value: text.slice(0, 110) });
      openLoops.push(`Follow up on: ${text.slice(0, 80)}`);
    } else if (/(my sister|my brother|my manager|my boss|my friend)/.test(lower)) {
      facts.push({ type: "person", value: text.slice(0, 110) });
    }
  }

  const firstSnippet = userMsgs[0].text.trim().slice(0, 100);
  const lastSnippet = userMsgs[userMsgs.length - 1].text.trim().slice(0, 100);
  const summary =
    userMsgs.length === 1
      ? `Discussed: "${firstSnippet}" with ${persona.label}.`
      : `Explored ${userMsgs.length} turns starting with "${firstSnippet}" and moving toward "${lastSnippet}".`;

  const hasWorry = topics.has("mindset");
  const session: MemorySessionSummary = {
    id: `sess_${Date.now()}`,
    dateIso: new Date().toISOString(),
    personaKey: persona.key,
    personaLabel: persona.label,
    summary,
    topics: topics.size > 0 ? Array.from(topics).slice(0, 4) : ["daily"],
    emotionalTone: hasWorry ? "stressed -> grounded" : "engaged -> steady",
    openLoops: openLoops.slice(0, 2),
  };

  return { session, facts };
}
