import {
  resolvePersonaVoiceSpec,
  type CompanionIdentity,
  type CompanionMemoryState,
  type FocusWeights,
  type ProactiveCheckIn,
  type ProactiveTriggerId,
} from "../types/kith";

export const PROACTIVE_STORAGE_KEY = "aip_proactive_state";

const SESSION_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes after last user turn
const DISMISSAL_COOLDOWN_MS = 72 * 60 * 60 * 1000; // 72 hours per trigger
const PAUSE_AFTER_3_DISMISSALS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_DAILY_PROACTIVE = 2;

const TRIGGER_COOLDOWN_MS: Record<ProactiveTriggerId, number> = {
  openLoop: 24 * 60 * 60 * 1000,
  timeAwareness: 12 * 60 * 60 * 1000,
  returnAfterAbsence: 7 * 24 * 60 * 60 * 1000,
  focusAlignment: 48 * 60 * 60 * 1000,
};

export interface ProactiveTrackerState {
  sentTimestamps: string[];
  perTriggerLastSent: Partial<Record<ProactiveTriggerId, string>>;
  perTriggerDismissedUntil: Partial<Record<ProactiveTriggerId, string>>;
  consecutiveDismissals: number;
  pausedUntilIso?: string;
  pauseOfferShown?: boolean;
}

const DEFAULT_TRACKER_STATE: ProactiveTrackerState = {
  sentTimestamps: [],
  perTriggerLastSent: {},
  perTriggerDismissedUntil: {},
  consecutiveDismissals: 0,
};

export function readProactiveState(): ProactiveTrackerState {
  if (typeof window === "undefined") return DEFAULT_TRACKER_STATE;
  try {
    const raw = window.localStorage.getItem(PROACTIVE_STORAGE_KEY);
    if (!raw || raw === "undefined" || raw === "null") {
      return DEFAULT_TRACKER_STATE;
    }
    const parsed = JSON.parse(raw) as Partial<ProactiveTrackerState>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_TRACKER_STATE;
    return {
      sentTimestamps: Array.isArray(parsed.sentTimestamps)
        ? parsed.sentTimestamps.filter((x) => typeof x === "string").slice(-20)
        : [],
      perTriggerLastSent:
        parsed.perTriggerLastSent && typeof parsed.perTriggerLastSent === "object"
          ? parsed.perTriggerLastSent
          : {},
      perTriggerDismissedUntil:
        parsed.perTriggerDismissedUntil &&
        typeof parsed.perTriggerDismissedUntil === "object"
          ? parsed.perTriggerDismissedUntil
          : {},
      consecutiveDismissals: Number.isFinite(Number(parsed.consecutiveDismissals))
        ? Math.max(0, Number(parsed.consecutiveDismissals))
        : 0,
      pausedUntilIso:
        typeof parsed.pausedUntilIso === "string" ? parsed.pausedUntilIso : undefined,
      pauseOfferShown: Boolean(parsed.pauseOfferShown),
    };
  } catch {
    return DEFAULT_TRACKER_STATE;
  }
}

function writeProactiveState(state: ProactiveTrackerState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROACTIVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function isTriggerOnCooldown(
  triggerId: ProactiveTriggerId,
  tracker: ProactiveTrackerState,
  nowMs: number
): boolean {
  const dismissedUntil = tracker.perTriggerDismissedUntil[triggerId];
  if (dismissedUntil) {
    const untilMs = Date.parse(dismissedUntil);
    if (Number.isFinite(untilMs) && nowMs < untilMs) {
      return true;
    }
  }
  const lastSent = tracker.perTriggerLastSent[triggerId];
  if (lastSent) {
    const sentMs = Date.parse(lastSent);
    if (Number.isFinite(sentMs) && nowMs - sentMs < TRIGGER_COOLDOWN_MS[triggerId]) {
      return true;
    }
  }
  return false;
}

export function canSendAnyProactive(
  memory: CompanionMemoryState,
  lastUserMessageIso?: string,
  now = new Date()
): boolean {
  if (!memory.memoryEnabled || !memory.proactiveEnabled) return false;
  if (memory.sessions.length === 0 && memory.facts.length === 0) {
    return false;
  }

  const nowMs = now.getTime();
  if (lastUserMessageIso) {
    const lastMsgMs = Date.parse(lastUserMessageIso);
    if (Number.isFinite(lastMsgMs) && nowMs - lastMsgMs < SESSION_COOLDOWN_MS) {
      return false;
    }
  }

  const tracker = readProactiveState();
  if (tracker.pausedUntilIso) {
    const pauseMs = Date.parse(tracker.pausedUntilIso);
    if (Number.isFinite(pauseMs) && nowMs < pauseMs) {
      return false;
    }
  }

  const oneDayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const recentCount = tracker.sentTimestamps.filter((ts) => {
    const ms = Date.parse(ts);
    return Number.isFinite(ms) && ms >= oneDayAgoMs;
  }).length;

  return recentCount < MAX_DAILY_PROACTIVE;
}

export interface EvaluatedTrigger {
  triggerId: ProactiveTriggerId;
  label: string;
  context: string;
}

export function evaluateProactiveTrigger(
  memory: CompanionMemoryState,
  _identity: CompanionIdentity,
  weights: FocusWeights,
  lastUserMessageIso?: string,
  now = new Date()
): EvaluatedTrigger | null {
  if (!canSendAnyProactive(memory, lastUserMessageIso, now)) {
    return null;
  }

  const tracker = readProactiveState();
  const nowMs = now.getTime();

  // 1. Open loop follow-up (highest Jarvis value)
  const openLoopSession = [...memory.sessions]
    .reverse()
    .find((s) => s.openLoops && s.openLoops.length > 0);
  if (
    openLoopSession &&
    !isTriggerOnCooldown("openLoop", tracker, nowMs)
  ) {
    return {
      triggerId: "openLoop",
      label: "Open loop follow-up",
      context: openLoopSession.openLoops[0],
    };
  }

  // 2. Return after >= 48h absence
  const lastActivityIso =
    memory.lastSessionEndedIso ||
    memory.sessions[memory.sessions.length - 1]?.dateIso;
  if (lastActivityIso && !isTriggerOnCooldown("returnAfterAbsence", tracker, nowMs)) {
    const lastMs = Date.parse(lastActivityIso);
    if (Number.isFinite(lastMs) && nowMs - lastMs >= 48 * 60 * 60 * 1000) {
      const topTopic =
        memory.sessions[memory.sessions.length - 1]?.topics?.[0] ||
        memory.facts[0]?.value ||
        "what you were working on";
      return {
        triggerId: "returnAfterAbsence",
        label: "Return check-in",
        context: `User hasn't dropped in for a couple of days; recent focus: ${topTopic}`,
      };
    }
  }

  // 3. Time-of-day awareness (late night >= 22:30 or early morning 05:30-07:30)
  const hour = now.getHours();
  if (
    (hour >= 22 || hour < 5) &&
    !isTriggerOnCooldown("timeAwareness", tracker, nowMs)
  ) {
    const topWorryOrGoal =
      memory.facts.find((f) => f.category === "worry" || f.category === "goal")
        ?.value || "winding down cleanly for tonight";
    return {
      triggerId: "timeAwareness",
      label: "Late-hour check-in",
      context: `Local time is late (${hour}:00). Active context: ${topWorryOrGoal}`,
    };
  }

  // 4. Focus-aligned gentle check-in when user has stored goals/projects
  const goalFact = memory.facts.find(
    (f) => f.category === "goal" || f.category === "project"
  );
  if (goalFact && !isTriggerOnCooldown("focusAlignment", tracker, nowMs)) {
    const focusAngle =
      weights.intellect >= weights.trust
        ? "crisp next step"
        : "calm encouragement";
    return {
      triggerId: "focusAlignment",
      label: "Focus check-in",
      context: `Active ${goalFact.category}: "${goalFact.value}" (lean toward ${focusAngle})`,
    };
  }

  return null;
}

export function recordProactiveSent(triggerId: ProactiveTriggerId, now = new Date()): void {
  const tracker = readProactiveState();
  const iso = now.toISOString();
  const oneDayAgoMs = now.getTime() - 24 * 60 * 60 * 1000;
  const recent = tracker.sentTimestamps.filter((ts) => {
    const ms = Date.parse(ts);
    return Number.isFinite(ms) && ms >= oneDayAgoMs;
  });
  writeProactiveState({
    ...tracker,
    sentTimestamps: [...recent, iso].slice(-20),
    perTriggerLastSent: {
      ...tracker.perTriggerLastSent,
      [triggerId]: iso,
    },
  });
}

export function recordProactiveDismissed(
  triggerId: ProactiveTriggerId,
  now = new Date()
): { consecutiveDismissals: number; shouldOfferPause: boolean } {
  const tracker = readProactiveState();
  const nextStreak = tracker.consecutiveDismissals + 1;
  const cooldownIso = new Date(now.getTime() + DISMISSAL_COOLDOWN_MS).toISOString();
  const pausedUntilIso =
    nextStreak >= 3
      ? new Date(now.getTime() + PAUSE_AFTER_3_DISMISSALS_MS).toISOString()
      : tracker.pausedUntilIso;
  const shouldOfferPause = nextStreak >= 3 && !tracker.pauseOfferShown;

  writeProactiveState({
    ...tracker,
    consecutiveDismissals: nextStreak,
    perTriggerDismissedUntil: {
      ...tracker.perTriggerDismissedUntil,
      [triggerId]: cooldownIso,
    },
    pausedUntilIso,
    pauseOfferShown: tracker.pauseOfferShown || shouldOfferPause,
  });

  return { consecutiveDismissals: nextStreak, shouldOfferPause };
}

export function resetProactiveDismissalStreak(): void {
  const tracker = readProactiveState();
  if (tracker.consecutiveDismissals === 0 && !tracker.pausedUntilIso) return;
  writeProactiveState({
    ...tracker,
    consecutiveDismissals: 0,
    pausedUntilIso: undefined,
    pauseOfferShown: false,
  });
}

export function buildOfflineProactiveCheckIn(
  trigger: EvaluatedTrigger,
  identity: CompanionIdentity
): ProactiveCheckIn {
  const persona = resolvePersonaVoiceSpec(
    identity.activeNickname,
    identity.primaryName
  );
  const name = identity.primaryName || "Julian";
  const isYouth = identity.userAgeBand === "0-10";
  const isBoss = persona.key === "strategist";
  const isProf = persona.key === "scholar";

  const cleanContext = trigger.context
    .replace(/^(Check in on:|Follow up on:|Active goal:|Active project:)\s*/i, "")
    .trim();

  let text = "";
  if (trigger.triggerId === "openLoop") {
    text = isBoss
      ? `Quick check on "${cleanContext.slice(0, 75)}" — did you close that loop or do you want a fast next move?`
      : isProf
      ? `Thinking about "${cleanContext.slice(0, 75)}". How did it unfold, and what piece is worth unpacking next?`
      : isYouth
      ? `Hey! How did things go with "${cleanContext.slice(0, 70)}"? ${name} is right here if you want to chat about it.`
      : `How did things go with "${cleanContext.slice(0, 75)}"? No rush—here whenever you want to talk it through.`;
  } else if (trigger.triggerId === "timeAwareness") {
    text = isBoss
      ? `Late hour — wrap up anything urgent and protect your sleep. Want a quick 3-bullet parking list for tomorrow?`
      : `It's getting late. Anything sitting on your mind that would help to set down before resting?`;
  } else if (trigger.triggerId === "returnAfterAbsence") {
    text = isBoss
      ? `Good to have you back. Pick one thing to push forward today and we'll make quick work of it.`
      : `Good to see you back. Whenever you're ready, we can pick right back up or start fresh.`;
  } else {
    text = isBoss
      ? `Still pushing forward on "${cleanContext.slice(0, 65)}"? Tell me the single blocker and we'll clear it.`
      : `Checking in on "${cleanContext.slice(0, 65)}". Want a quick brainstorm or a steady sounding board today?`;
  }

  return {
    id: `pro_${Date.now()}`,
    triggerId: trigger.triggerId,
    personaKey: persona.key,
    personaLabel: persona.label,
    text,
    contextSummary: trigger.label,
    gesture: persona.recommendedGesture,
    voiceTone: isBoss ? "witty" : isProf ? "calm" : "warm",
    createdAtIso: new Date().toISOString(),
  };
}
