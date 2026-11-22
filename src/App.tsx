import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Contrast, Moon, RotateCcw, Sun, X } from "lucide-react";
import {
  auth,
  deleteJournalFromFirestore,
  fetchActivityFromFirestore,
  fetchCompanionFromFirestore,
  fetchJournalsFromFirestore,
  fetchStoriesFromFirestore,
  fetchUserProfileFromFirestore,
  loadLocalActivity,
  loadLocalCompanion,
  loadLocalGuardian,
  loadLocalJournals,
  loadLocalStories,
  logActivityToFirestore,
  saveCompanionToFirestore,
  saveJournalToFirestore,
  saveLocalActivity,
  saveLocalCompanion,
  saveLocalGuardian,
  saveLocalJournals,
  saveLocalStories,
  saveStoryToFirestore,
  signInWithGoogle,
  signOutUser,
  syncUserProfileToFirestore,
  testConnection,
} from "./lib/firebase";
import {
  DEFAULT_COMPANION_IDENTITY,
  DEFAULT_GUARDIAN_PROFILE,
  DEFAULT_LEARNED_PREFERENCES,
  DEFAULT_MUSIC_SPEC,
  INDUSTRIES,
  computeFocusWeights,
  getGenderPronouns,
  hasIndustryWorkspace,
  hasSchoolFocus,
  resolvePersonaVoiceSpec,
  STUDIO_NAME_PRESETS,
  type ActivityLogItem,
  type AgeTier,
  type AppTheme,
  type ChatMessage,
  type CompanionIdentity,
  type CompanionMemoryState,
  type IndustryId,
  type JournalEntry,
  type LearnedPreferences,
  type MemoryFactCategory,
  type PersonaKey,
  type ProactiveTriggerId,
  type StoryRecord,
  type StudioTab,
  type UserGuardianProfile,
} from "./types/kith";
import { musicEngine } from "./lib/musicEngine";
import {
  AIP_STORAGE_KEYS,
  clearAllAipStorage,
  createWelcomeChatMessage,
  ensureStorageVersion,
  isOnboardingDone,
  loadChatHistory,
  loadLearnedPreferences,
  saveChatHistory,
  saveLearnedPreferences,
  setOnboardingDone,
  subscribeStorageWarnings,
} from "./lib/storage";
import {
  addManualMemoryFact,
  addMemorySession,
  buildMemoryContext,
  clearAllMemory,
  deleteMemoryFact,
  exportMemoryJson,
  extractLocalMemoryFallback,
  getMemorySizeBytes,
  getMemoryState,
  setMemorySettings,
  updateMemoryFacts,
  writeOnboardingIdentityMemory,
} from "./lib/memoryStore";
import {
  buildOfflineProactiveCheckIn,
  evaluateProactiveTrigger,
  recordProactiveDismissed,
  recordProactiveSent,
  resetProactiveDismissalStreak,
} from "./lib/proactiveEngine";
import {
  buildShareUrl,
  decodeShareHash,
  encodeShareDataOnly,
  areIdentitiesShareEqual,
  isAvatarCustomized,
} from "./lib/shareAvatar";
import { APP_COPY, type GentleNudgeVariant } from "./lib/copy";
import { IdentityStudioView } from "./components/IdentityStudioView";
import { LiveCompanionView } from "./components/LiveCompanionView";
import { HomeworkLabView } from "./components/HomeworkLabView";
import { JournalStoryView } from "./components/JournalStoryView";
import { GuardianSettingsView } from "./components/GuardianSettingsView";
import { AlwaysOnWidget } from "./components/AlwaysOnWidget";
import { OnboardingModal } from "./components/OnboardingModal";
import { ResetStudioModal } from "./components/ResetStudioModal";
import { MemoryViewerModal } from "./components/MemoryViewerModal";
import { ShareModal } from "./components/ShareModal";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useArchetypeCSSVars } from "./lib/archetypeTheme";

const THEME_STORAGE_KEY = "aip_theme";

function loadSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "dim" || saved === "light") {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return "dark";
}

export default function App() {
  const [theme, setTheme] = useState<AppTheme>(() => loadSavedTheme());
  const [activeTab, setActiveTab] = useState<StudioTab>("identity");
  const [activeIndustryModuleId, setActiveIndustryModuleId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [offlineMode, setOfflineMode] = useState<boolean>(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  // Warm up browser speech synthesis voices immediately on page load
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  const [initialShare] = useState(() =>
    typeof window !== "undefined" ? decodeShareHash(window.location.hash) : null
  );
  const [hadSavedAvatarOnLoad] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return Boolean(window.localStorage.getItem(AIP_STORAGE_KEYS.companion));
    } catch {
      return false;
    }
  });
  const isOwnSharedLink = Boolean(
    initialShare &&
      hadSavedAvatarOnLoad &&
      areIdentitiesShareEqual(loadLocalCompanion(), initialShare.identity)
  );

  const [identity, setIdentity] = useState<CompanionIdentity>(() => {
    ensureStorageVersion();
    return initialShare ? initialShare.identity : loadLocalCompanion();
  });
  const [guardian, setGuardian] = useState<UserGuardianProfile>(() =>
    loadLocalGuardian()
  );
  const [journals, setJournals] = useState<JournalEntry[]>(() =>
    loadLocalJournals()
  );
  const [stories, setStories] = useState<StoryRecord[]>(() =>
    loadLocalStories()
  );
  const [activityLog, setActivityLog] = useState<ActivityLogItem[]>(() =>
    loadLocalActivity()
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() =>
    loadChatHistory(initialShare ? initialShare.identity : loadLocalCompanion())
  );
  const [learnedPreferences, setLearnedPreferences] = useState<LearnedPreferences>(() =>
    loadLearnedPreferences()
  );
  const [duplicateBannerOpen, setDuplicateBannerOpen] = useState<boolean>(
    Boolean(initialShare && !isOwnSharedLink)
  );
  const [duplicateBannerSummary] = useState<string | null>(
    initialShare && !isOwnSharedLink ? initialShare.summary : null
  );
  const [startedFromShared, setStartedFromShared] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("aip_shared_origin") === "true";
    } catch {
      return false;
    }
  });
  const [originTooltipOpen, setOriginTooltipOpen] = useState(false);
  const [showGentleNudge, setShowGentleNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [hasChattedAfterDup, setHasChattedAfterDup] = useState(false);
  const [browsedArchetypes, setBrowsedArchetypes] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [studioToast, setStudioToast] = useState<string | null>(null);
  const [corruptShareNotice, setCorruptShareNotice] = useState<string | null>(() => {
    if (
      typeof window !== "undefined" &&
      window.location.hash.startsWith("#a=") &&
      !initialShare
    ) {
      return "That link was incomplete. Loaded your saved studio defaults instead.";
    }
    return null;
  });
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState<boolean>(() => {
    if (initialShare) return false;
    return !isOnboardingDone();
  });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [memoryState, setMemoryState] = useState<CompanionMemoryState>(() =>
    getMemoryState()
  );
  const [memoryViewerOpen, setMemoryViewerOpen] = useState(false);
  const [hasUnreadProactive, setHasUnreadProactive] = useState(false);
  const [proactivePauseOffer, setProactivePauseOffer] = useState(false);
  const [memoryUpdatedToast, setMemoryUpdatedToast] = useState<string | null>(null);

  useArchetypeCSSVars(identity.archetype);

  const companionSyncTimer = useRef<number | null>(null);
  const guardianSyncTimer = useRef<number | null>(null);
  const proactiveEvaluatedRef = useRef(false);
  const memoryToastShownRef = useRef(false);
  const memoryToastTimerRef = useRef<number | null>(null);
  const studioToastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return subscribeStorageWarnings((msg) => setStorageWarning(msg));
  }, []);

  useEffect(() => {
    if (!startedFromShared || nudgeDismissed) {
      setShowGentleNudge(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowGentleNudge(true);
    }, 5 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [startedFromShared, nudgeDismissed]);

  const selectedIndustry: IndustryId = identity.selectedIndustry || "NONE";
  const industrySpec = INDUSTRIES[selectedIndustry] || INDUSTRIES.NONE;
  const enabledIndustryModules = identity.enabledIndustryModules || [];
  const showIndustryDesk = hasIndustryWorkspace(identity);
  const showStudyLab = hasSchoolFocus(identity);
  const pronouns = getGenderPronouns(identity.gender);
  const navItems: { id: StudioTab; label: string }[] = [
    { id: "identity", label: "Identity Studio" },
    { id: "companion", label: "Live Companion" },
    ...(showIndustryDesk
      ? [{ id: "homework" as const, label: industrySpec.shortDeskLabel }]
      : []),
    { id: "journal", label: "Journal & Story" },
    { id: "guardian", label: "Guardian" },
  ];

  useEffect(() => {
    if (activeTab === "homework" && !showIndustryDesk) {
      setActiveTab("identity");
    }
  }, [activeTab, showIndustryDesk]);

  const activeFocusWeights = computeFocusWeights(
    identity.userAgeBand || "11-20",
    identity.warmthHumor,
    identity.scholarlyDepth,
    identity.maturityMode || "maturing"
  ).weights;
  const activePersona = resolvePersonaVoiceSpec(
    identity.activeNickname,
    identity.primaryName
  );
  const memoryContextResult = buildMemoryContext(
    activePersona.key,
    activeFocusWeights,
    memoryState
  );

  useEffect(() => {
    testConnection();
    const handleOnline = () => setOfflineMode(false);
    const handleOffline = () => setOfflineMode(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      musicEngine.stop();
      if (memoryToastTimerRef.current) {
        window.clearTimeout(memoryToastTimerRef.current);
      }
    };
  }, []);

  // Evaluate subtle proactive check-in on session start (respects cooldowns, max 2/day, opt-in)
  useEffect(() => {
    if (onboardingOpen || proactiveEvaluatedRef.current) return;
    proactiveEvaluatedRef.current = true;

    const lastUserMsg = [...chatMessages]
      .reverse()
      .find((m) => m.role === "user");
    const recentProactiveExists = chatMessages.some((m) => {
      if (!m.isProactive || !m.createdAtIso) return false;
      const ms = Date.parse(m.createdAtIso);
      return Number.isFinite(ms) && Date.now() - ms < 12 * 60 * 60 * 1000;
    });
    if (recentProactiveExists) return;

    const trigger = evaluateProactiveTrigger(
      memoryState,
      identity,
      activeFocusWeights,
      lastUserMsg?.createdAtIso
    );
    if (!trigger) return;

    let cancelled = false;
    (async () => {
      let checkIn = buildOfflineProactiveCheckIn(trigger, identity);
      const onlineNow =
        !offlineMode &&
        (typeof navigator === "undefined" || navigator.onLine);
      if (onlineNow) {
        try {
          const res = await fetch("/api/kith/proactive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              triggerId: trigger.triggerId,
              triggerContext: trigger.context,
              identity,
              ageTier: guardian.ageTier,
              userName: guardian.displayName,
              memoryContext: memoryContextResult.contextText,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (typeof data.text === "string" && data.text.trim().length > 0) {
              checkIn = {
                ...checkIn,
                text: data.text.trim(),
                gesture: data.gesture || checkIn.gesture,
                voiceTone: data.voiceTone || checkIn.voiceTone,
              };
            }
          }
        } catch {
          // Offline fallback checkIn already built cleanly
        }
      }
      if (cancelled) return;

      const proactiveMsg: ChatMessage = {
        id: checkIn.id,
        role: "kith",
        text: checkIn.text,
        gesture: checkIn.gesture,
        voiceTone: checkIn.voiceTone,
        personaLabel: checkIn.personaLabel,
        createdAtIso: checkIn.createdAtIso,
        isProactive: true,
        proactiveTriggerId: checkIn.triggerId,
      };
      setChatMessages((prev) => {
        const next = [...prev, proactiveMsg].slice(-50);
        saveChatHistory(next);
        return next;
      });
      recordProactiveSent(trigger.triggerId);
      setHasUnreadProactive(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboardingOpen]);

  useEffect(() => {
    musicEngine.setVolume(identity.musicVolume ?? 42);
    const activeSpec = identity.musicSpec || DEFAULT_MUSIC_SPEC;
    musicEngine.setSpec(activeSpec);
    if (!identity.musicEnabled || identity.musicPreset === "none") {
      if (musicEngine.isPlaying()) {
        musicEngine.stop();
      }
    }
  }, [
    identity.musicEnabled,
    identity.musicVolume,
    identity.musicPreset,
    identity.musicSpec,
  ]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) return;

      try {
        const [remoteProfile, remoteCompanion, remoteJournals, remoteStories, remoteActivity] =
          await Promise.all([
            fetchUserProfileFromFirestore(nextUser),
            fetchCompanionFromFirestore(nextUser.uid),
            fetchJournalsFromFirestore(nextUser.uid),
            fetchStoriesFromFirestore(nextUser.uid),
            fetchActivityFromFirestore(nextUser.uid),
          ]);

        if (remoteProfile) {
          setGuardian(remoteProfile);
          saveLocalGuardian(remoteProfile);
        } else {
          await syncUserProfileToFirestore(nextUser, guardian);
        }

        if (remoteCompanion) {
          setIdentity(remoteCompanion);
          saveLocalCompanion(remoteCompanion);
        } else {
          await saveCompanionToFirestore(nextUser.uid, identity);
        }

        if (remoteJournals.length > 0) {
          setJournals(remoteJournals);
          saveLocalJournals(remoteJournals);
        }
        if (remoteStories.length > 0) {
          setStories(remoteStories);
          saveLocalStories(remoteStories);
        }
        if (remoteActivity.length > 0) {
          setActivityLog(remoteActivity);
          saveLocalActivity(remoteActivity);
        }
      } catch (err) {
        console.error("Failed loading remote companion data:", err);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerStudioToast(message: string, durationMs = 2800) {
    setStudioToast(message);
    if (studioToastTimerRef.current) {
      window.clearTimeout(studioToastTimerRef.current);
    }
    studioToastTimerRef.current = window.setTimeout(() => {
      setStudioToast(null);
    }, durationMs);
  }

  async function copyTextToClipboard(text: string) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    } catch {
      // ignore clipboard restrictions cleanly
    }
  }

  function clearSharedOriginFlag() {
    if (startedFromShared) {
      setStartedFromShared(false);
      setShowGentleNudge(false);
      setOriginTooltipOpen(false);
      try {
        window.localStorage.removeItem("aip_shared_origin");
      } catch {
        // ignore storage errors
      }
    }
  }

  function scrollToArchetypesAndHighlight() {
    setActiveTab("identity");
    window.setTimeout(() => {
      const el = document.getElementById("archetype-selector");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-emerald-500");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-emerald-500");
      }, 2000);
    }, 60);
  }

  function handleDuplicateFromBanner(isEmptyRecipient: boolean) {
    saveLocalCompanion(identity);
    try {
      window.localStorage.setItem("aip_shared_origin", "true");
    } catch {
      // ignore storage errors
    }
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setDuplicateBannerOpen(false);
    setStartedFromShared(true);
    setNudgeDismissed(false);
    triggerStudioToast(
      isEmptyRecipient
        ? APP_COPY.duplicateBanner.empty.makeItMineToast
        : APP_COPY.duplicateBanner.normal.toast
    );
  }

  function handleBuildOwnFromBanner() {
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setDuplicateBannerOpen(false);
    setStartedFromShared(false);
    setIdentity(DEFAULT_COMPANION_IDENTITY);
    setChatMessages([createWelcomeChatMessage(DEFAULT_COMPANION_IDENTITY)]);
    if (!isOnboardingDone()) {
      setOnboardingOpen(true);
    } else {
      scrollToArchetypesAndHighlight();
    }
    triggerStudioToast(APP_COPY.duplicateBanner.empty.buildOwnToast);
  }

  function handleUpdateIdentity(next: CompanionIdentity) {
    clearSharedOriginFlag();
    setIdentity(next);
    saveLocalCompanion(next);
    if (user && !offlineMode) {
      if (companionSyncTimer.current) {
        window.clearTimeout(companionSyncTimer.current);
      }
      companionSyncTimer.current = window.setTimeout(() => {
        saveCompanionToFirestore(user.uid, next).catch(console.error);
      }, 650);
    }
  }

  function handleUpdateGuardian(next: UserGuardianProfile) {
    setGuardian(next);
    saveLocalGuardian(next);
    if (user && !offlineMode) {
      if (guardianSyncTimer.current) {
        window.clearTimeout(guardianSyncTimer.current);
      }
      guardianSyncTimer.current = window.setTimeout(() => {
        syncUserProfileToFirestore(user, next).catch(console.error);
      }, 650);
    }
  }

  function handleSaveJournal(entry: JournalEntry) {
    const updated = [entry, ...journals];
    setJournals(updated);
    saveLocalJournals(updated);
    if (user && !offlineMode) {
      saveJournalToFirestore(user.uid, entry).catch(console.error);
    }
  }

  function handleDeleteJournal(id: string) {
    const updated = journals.filter((j) => j.id !== id);
    setJournals(updated);
    saveLocalJournals(updated);
    if (user && !offlineMode) {
      deleteJournalFromFirestore(user.uid, id).catch(console.error);
    }
  }

  function handleSaveStory(story: StoryRecord) {
    const updated = [story, ...stories];
    setStories(updated);
    saveLocalStories(updated);
    if (user && !offlineMode) {
      saveStoryToFirestore(user.uid, story).catch(console.error);
    }
  }

  function handleLogActivity(
    summary: string,
    mode: ActivityLogItem["mode"] = "identity"
  ) {
    const item: ActivityLogItem = {
      id: `act_${Date.now()}`,
      mode,
      summary,
      durationMinutes: 2,
      createdAtIso: new Date().toISOString(),
    };
    const updated = [item, ...activityLog].slice(0, 30);
    setActivityLog(updated);
    saveLocalActivity(updated);

    const nextGuardian = {
      ...guardian,
      minutesUsedToday: Math.min(1440, guardian.minutesUsedToday + 2),
    };
    handleUpdateGuardian(nextGuardian);

    if (user && !offlineMode) {
      logActivityToFirestore(user.uid, item).catch(console.error);
    }
  }

  function handleUpdateMessages(next: ChatMessage[]) {
    const capped = next.slice(-50);
    setChatMessages(capped);
    saveChatHistory(capped);
  }

  function handleClearChat() {
    const fresh = [createWelcomeChatMessage(identity)];
    setChatMessages(fresh);
    saveChatHistory(fresh);
  }

  function handleRateMessage(msgId: string, rating: "up" | "down") {
    const targetMsg = chatMessages.find((m) => m.id === msgId);
    if (!targetMsg) return;
    const prevFeedback = targetMsg.feedback;
    const nextFeedback = prevFeedback === rating ? undefined : rating;

    const updatedMsgs = chatMessages.map((m) =>
      m.id === msgId ? { ...m, feedback: nextFeedback } : m
    );
    handleUpdateMessages(updatedMsgs);

    const hintSource =
      targetMsg.evolutionNote?.trim() ||
      `${targetMsg.voiceTone || identity.voiceTone} reply (${targetMsg.gesture || "warm_nod"}): "${targetMsg.text.slice(0, 72)}${targetMsg.text.length > 72 ? "..." : ""}"`;

    setLearnedPreferences((prev) => {
      let upCount = prev.upCount;
      let downCount = prev.downCount;
      if (prevFeedback === "up") upCount = Math.max(0, upCount - 1);
      if (prevFeedback === "down") downCount = Math.max(0, downCount - 1);
      if (nextFeedback === "up") upCount += 1;
      if (nextFeedback === "down") downCount += 1;

      const likedNotes =
        nextFeedback === "up"
          ? [hintSource, ...prev.likedNotes.filter((n) => n !== hintSource)].slice(0, 12)
          : prev.likedNotes.filter((n) => (prevFeedback === "up" ? n !== hintSource : true));
      const dislikedNotes =
        nextFeedback === "down"
          ? [hintSource, ...prev.dislikedNotes.filter((n) => n !== hintSource)].slice(0, 12)
          : prev.dislikedNotes.filter((n) => (prevFeedback === "down" ? n !== hintSource : true));

      const nextPrefs: LearnedPreferences = {
        likedNotes,
        dislikedNotes,
        upCount,
        downCount,
        lastUpdatedIso: new Date().toISOString(),
      };
      saveLearnedPreferences(nextPrefs);
      return nextPrefs;
    });

    if (nextFeedback && identity.adaptiveSelfTuning !== false) {
      const tone = targetMsg.voiceTone || identity.voiceTone;
      const isHumorous = tone === "witty" || tone === "excited";
      const delta = nextFeedback === "up" ? 2 : -3;
      const nextWarmth = Math.max(
        10,
        Math.min(100, identity.warmthHumor + (isHumorous ? delta : 0))
      );
      const nextDepth = Math.max(
        15,
        Math.min(100, identity.scholarlyDepth + (!isHumorous ? delta : 0))
      );
      if (nextWarmth !== identity.warmthHumor || nextDepth !== identity.scholarlyDepth) {
        handleUpdateIdentity({
          ...identity,
          warmthHumor: nextWarmth,
          scholarlyDepth: nextDepth,
        });
      }
    }
  }

  function handleClearLearnedPreferences() {
    setLearnedPreferences(DEFAULT_LEARNED_PREFERENCES);
    saveLearnedPreferences(DEFAULT_LEARNED_PREFERENCES);
  }

  function handleCompleteOnboarding(
    nextIdentity: CompanionIdentity,
    nextUserName: string,
    nextAgeTier: AgeTier,
    options?: { memoryEnabled: boolean; note?: string }
  ) {
    const memoryEnabled = options?.memoryEnabled ?? true;
    setMemorySettings({ memoryEnabled });
    const nextMem = writeOnboardingIdentityMemory(nextIdentity, options?.note);
    setMemoryState(nextMem);

    setOnboardingDone(true);
    setOnboardingOpen(false);
    handleUpdateIdentity(nextIdentity);
    handleUpdateGuardian({
      ...guardian,
      displayName: nextUserName,
      ageTier: nextAgeTier,
    });
    if (chatMessages.length <= 1 && chatMessages[0]?.id === "welcome-1") {
      handleUpdateMessages([createWelcomeChatMessage(nextIdentity)]);
    }
  }

  function showOnceMemoryToast(msg: string) {
    if (memoryToastShownRef.current) return;
    memoryToastShownRef.current = true;
    setMemoryUpdatedToast(msg);
    if (memoryToastTimerRef.current) {
      window.clearTimeout(memoryToastTimerRef.current);
    }
    memoryToastTimerRef.current = window.setTimeout(() => {
      setMemoryUpdatedToast(null);
    }, 3500);
  }

  async function handleSummarizeSession(
    msgs: ChatMessage[],
    personaKey: PersonaKey,
    personaLabel: string
  ): Promise<boolean> {
    if (!memoryState.memoryEnabled) return false;
    const userTurns = msgs.filter((m) => m.role === "user");
    if (userTurns.length < 2) return false;

    const onlineNow =
      !offlineMode && (typeof navigator === "undefined" || navigator.onLine);
    let saved = false;

    if (onlineNow) {
      try {
        const res = await fetch("/api/kith/summarize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: msgs.slice(-24).map((m) => ({ role: m.role, text: m.text })),
            identity,
            personaLabel,
            userName: guardian.displayName,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.isTrivial) {
            return false;
          }
          if (typeof data.summary === "string" && data.summary.trim().length > 0) {
            let nextMem = addMemorySession({
              id: `sess_${Date.now()}`,
              dateIso: new Date().toISOString(),
              personaKey,
              personaLabel,
              summary: data.summary,
              topics: Array.isArray(data.topics) ? data.topics : [],
              emotionalTone:
                typeof data.emotionalTone === "string"
                  ? data.emotionalTone
                  : "steady",
              openLoops: Array.isArray(data.openLoops) ? data.openLoops : [],
            });
            if (Array.isArray(data.newFacts) && data.newFacts.length > 0) {
              nextMem = updateMemoryFacts(data.newFacts, personaKey).state;
            }
            setMemoryState(nextMem);
            saved = true;
          }
        }
      } catch {
        // fallback cleanly to deterministic local extraction below
      }
    }

    if (!saved) {
      const local = extractLocalMemoryFallback(msgs, identity);
      if (local.session) {
        let nextMem = addMemorySession(local.session);
        if (local.facts.length > 0) {
          nextMem = updateMemoryFacts(local.facts, personaKey).state;
        }
        setMemoryState(nextMem);
        saved = true;
      }
    }

    if (saved) {
      showOnceMemoryToast(`${identity.primaryName} remembered highlights from this session`);
    }
    return saved;
  }

  function handleDismissProactive(msgId: string, triggerId: ProactiveTriggerId) {
    const updated = chatMessages.map((m) =>
      m.id === msgId ? { ...m, proactiveDismissed: true } : m
    );
    handleUpdateMessages(updated);
    setHasUnreadProactive(false);
    const { shouldOfferPause } = recordProactiveDismissed(triggerId);
    if (shouldOfferPause) {
      setProactivePauseOffer(true);
    }
  }

  function handleRespondPauseProactive(pause: boolean) {
    setProactivePauseOffer(false);
    if (pause) {
      setMemoryState(setMemorySettings({ proactiveEnabled: false }));
    } else {
      resetProactiveDismissalStreak();
    }
  }

  function handleToggleMemoryConsent(enabled: boolean) {
    setMemoryState(setMemorySettings({ memoryEnabled: enabled }));
  }

  function handleToggleProactiveConsent(enabled: boolean) {
    if (enabled) {
      resetProactiveDismissalStreak();
    }
    setMemoryState(setMemorySettings({ proactiveEnabled: enabled }));
  }

  function handleAddManualFact(category: MemoryFactCategory, value: string) {
    setMemoryState(addManualMemoryFact(category, value, "all"));
  }

  function handleDeleteMemoryFact(factId: string) {
    setMemoryState(deleteMemoryFact(factId));
  }

  function handleClearAllMemory() {
    setMemoryState(clearAllMemory());
  }

  function handleSkipOnboarding() {
    setOnboardingDone(true);
    setOnboardingOpen(false);
  }

  function handleRerunOnboarding() {
    setResetModalOpen(false);
    setOnboardingDone(false);
    setOnboardingOpen(true);
  }

  function handleResetAll() {
    setResetModalOpen(false);
    musicEngine.stop();
    clearAllAipStorage(true);
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setDuplicateBannerOpen(false);
    setStartedFromShared(false);
    setShowGentleNudge(false);
    setIdentity(DEFAULT_COMPANION_IDENTITY);
    setGuardian(DEFAULT_GUARDIAN_PROFILE);
    setJournals([]);
    setStories([]);
    setActivityLog([]);
    setLearnedPreferences(DEFAULT_LEARNED_PREFERENCES);
    setChatMessages([createWelcomeChatMessage(DEFAULT_COMPANION_IDENTITY)]);
    setMemoryState(getMemoryState());
    setHasUnreadProactive(false);
    setProactivePauseOffer(false);
    setMemoryViewerOpen(false);
    setActiveTab("identity");
    setOnboardingDone(false);
    setOnboardingOpen(true);
  }

  async function handleAuthClick() {
    setAuthError(null);
    try {
      if (user) {
        await signOutUser();
      } else {
        await signInWithGoogle();
      }
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Authentication could not complete."
      );
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      {/* Strict 3-Zone Top Bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b border-edge"
        style={{ backgroundColor: "var(--aip-header)" }}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab("identity")}
            className="font-display text-xl font-bold tracking-tight text-ink whitespace-nowrap shrink-0 cursor-pointer"
          >
            AI Person (AIP)
          </button>

          <nav
            aria-label="Primary studio sections"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-ink-muted"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                    active
                      ? "text-ink border-accent"
                      : "border-transparent hover:text-ink hover:border-edge-strong"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <div
              role="group"
              aria-label="Studio appearance theme"
              className="flex items-center gap-0.5 p-1 bg-surface-alt border border-edge rounded-lg"
            >
              {(
                [
                  { id: "dark", label: "Dark", Icon: Moon },
                  { id: "dim", label: "Dim", Icon: Contrast },
                  { id: "light", label: "Light", Icon: Sun },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = theme === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTheme(id)}
                    title={`${label} theme`}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-accent text-accent-fg"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={!authReady}
              onClick={handleAuthClick}
              className="px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              {user ? `Sign Out (${user.displayName?.split(" ")[0] || "Account"})` : "Sign In"}
            </button>
          </div>
        </div>

        {/* Mobile Secondary Tab Bar */}
        <div className="md:hidden border-t border-edge px-4 py-2 flex items-center gap-3 overflow-x-auto">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? "bg-accent text-accent-fg"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Shared-Link Duplicate Banner (Normal vs Empty Recipient State) */}
      {duplicateBannerOpen && (
        <div
          role="region"
          aria-label="Shared avatar notice"
          className="border-b border-accent/35 bg-accent-soft px-4 sm:px-6 lg:px-8 py-2.5"
        >
          <div className="max-w-[1280px] mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-ink leading-relaxed">
              {!hadSavedAvatarOnLoad
                ? APP_COPY.duplicateBanner.empty.text
                : duplicateBannerSummary
                ? `You're viewing ${duplicateBannerSummary}, shared by someone else. Want to make it your own?`
                : APP_COPY.duplicateBanner.normal.text}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleDuplicateFromBanner(!hadSavedAvatarOnLoad)}
                className="px-3 py-1.5 text-xs font-semibold bg-accent text-accent-fg rounded-lg hover:bg-accent-hover cursor-pointer whitespace-nowrap"
              >
                {!hadSavedAvatarOnLoad
                  ? APP_COPY.duplicateBanner.empty.primary
                  : APP_COPY.duplicateBanner.normal.primary}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!hadSavedAvatarOnLoad) {
                    handleBuildOwnFromBanner();
                  } else {
                    setDuplicateBannerOpen(false);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-surface border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink cursor-pointer whitespace-nowrap"
              >
                {!hadSavedAvatarOnLoad
                  ? APP_COPY.duplicateBanner.empty.secondary
                  : APP_COPY.duplicateBanner.normal.secondary}
              </button>
              <button
                type="button"
                aria-label="Dismiss shared avatar banner"
                onClick={() => setDuplicateBannerOpen(false)}
                className="p-1 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Three-Tier Editorial Hierarchy: AIP Main Title -> Studio Sub-titles -> User & Avatar Names */}
        <section className="bg-surface border border-edge rounded-2xl p-6 space-y-5">
          {/* Tier 1: Main Title (AI Person / AIP) */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-edge">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-ink [text-wrap:balance]">
                  AI Person (AIP)
                </h1>
                {startedFromShared && (
                  <div
                    className="relative inline-block"
                    onMouseLeave={() => setOriginTooltipOpen(false)}
                  >
                    <button
                      type="button"
                      onMouseEnter={() => setOriginTooltipOpen(true)}
                      onFocus={() => setOriginTooltipOpen(true)}
                      onBlur={() => setOriginTooltipOpen(false)}
                      onClick={() => setOriginTooltipOpen((v) => !v)}
                      aria-expanded={originTooltipOpen}
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-accent-soft border border-accent/35 text-accent-ink hover:border-accent transition-colors cursor-help"
                    >
                      {APP_COPY.originChip.label}
                    </button>
                    {originTooltipOpen && (
                      <div
                        role="tooltip"
                        className="absolute left-0 top-full mt-2 z-30 w-64 bg-surface border border-edge-strong rounded-xl p-3 text-[11px] text-ink shadow-xl space-y-2 leading-relaxed"
                      >
                        <p>{APP_COPY.originChip.tooltipBody}</p>
                        <p className="pt-2 border-t border-edge text-[10px] text-ink-muted">
                          {APP_COPY.originChip.tooltipFootnote}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-sm text-ink-muted">
                {identity.studioName || "Kith Studios"} — Companion Identity Studio &amp; Lifespan Evolution Previewer
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <div className="sm:text-right space-y-1">
                <div className="text-xs text-ink-muted">
                  {user
                    ? "Synced to your private cloud studio"
                    : "Local studio active · Sign in to sync across devices"}
                </div>
                <div className="text-[11px] font-medium text-accent-ink">
                  {selectedIndustry === "NONE"
                    ? "Universal companion mode"
                    : `${
                        selectedIndustry === "OTHER" && identity.otherIndustryName?.trim()
                          ? identity.otherIndustryName.trim()
                          : industrySpec.label
                      } · ${enabledIndustryModules.length} module${
                        enabledIndustryModules.length === 1 ? "" : "s"
                      } enabled`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium bg-surface-alt border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink cursor-pointer w-fit whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                Reset / Setup
              </button>
            </div>
          </div>

          {/* Tier 2: Sub-titles / Studio Names (Kith Studios & custom studios) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-semibold text-ink-secondary">
                Studio Subtitle
              </span>
              <input
                aria-label="Custom studio name"
                type="text"
                maxLength={60}
                value={identity.studioName || "Kith Studios"}
                onChange={(e) =>
                  handleUpdateIdentity({
                    ...identity,
                    studioName: e.target.value,
                  })
                }
                placeholder="Name your studio..."
                className="w-56 px-3 py-1.5 text-xs bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {STUDIO_NAME_PRESETS.map((studio) => {
                const active = (identity.studioName || "Kith Studios") === studio;
                return (
                  <button
                    key={studio}
                    type="button"
                    onClick={() =>
                      handleUpdateIdentity({ ...identity, studioName: studio })
                    }
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                    }`}
                  >
                    {studio}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tier 3: User Names & Avatar Names Used by Users */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-4 border-t border-edge">
            <div className="md:col-span-4 space-y-1.5">
              <label
                htmlFor="hierarchy-user-name"
                className="block text-xs font-semibold text-ink-secondary"
              >
                User Name
              </label>
              <input
                id="hierarchy-user-name"
                type="text"
                maxLength={80}
                value={guardian.displayName}
                onChange={(e) =>
                  handleUpdateGuardian({
                    ...guardian,
                    displayName: e.target.value,
                  })
                }
                onBlur={() => {
                  if (!guardian.displayName.trim()) {
                    handleUpdateGuardian({
                      ...guardian,
                      displayName: "Reader",
                    });
                  }
                }}
                placeholder="Your name..."
                className="w-full px-3 py-1.5 text-sm bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="md:col-span-8 space-y-1.5">
              <div className="text-xs font-semibold text-ink-secondary">
                Avatar Name &amp; Shorthand Names Used
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">
                  {identity.primaryName}
                </span>
                <span className="text-xs text-ink-muted pr-1">
                  ({pronouns.pronouns})
                </span>
                {identity.nicknames.map((nick) => {
                  const isActive = identity.activeNickname === nick;
                  return (
                    <button
                      key={nick}
                      type="button"
                      onClick={() =>
                        handleUpdateIdentity({
                          ...identity,
                          activeNickname: isActive ? "" : nick,
                        })
                      }
                      className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isActive
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                      }`}
                    >
                      {nick}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {corruptShareNotice && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <span>{corruptShareNotice}</span>
            <button
              type="button"
              aria-label="Dismiss incomplete share link notice"
              onClick={() => {
                setCorruptShareNotice(null);
                if (typeof window !== "undefined" && window.location.hash.startsWith("#a=")) {
                  window.history.replaceState(
                    null,
                    "",
                    window.location.pathname + window.location.search
                  );
                }
              }}
              className="hover:opacity-75 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {storageWarning && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
            <span>{storageWarning}</span>
            <button
              type="button"
              aria-label="Dismiss storage notice"
              onClick={() => setStorageWarning(null)}
              className="hover:opacity-75 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {authError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {authError}
          </div>
        )}

        <ErrorBoundary
          sectionName={navItems.find((n) => n.id === activeTab)?.label || "Studio"}
        >
          {activeTab === "identity" && (
            <IdentityStudioView
              identity={identity}
              userId={user?.uid ?? null}
              onUpdateIdentity={handleUpdateIdentity}
              offlineMode={offlineMode}
              onLogActivity={(summary) => handleLogActivity(summary, "identity")}
              onOpenTab={(tab, moduleId) => {
                if (moduleId) {
                  setActiveIndustryModuleId(moduleId);
                }
                setActiveTab(tab);
              }}
              learnedPreferences={learnedPreferences}
              chatMessageCount={chatMessages.length}
              onClearLearnedPreferences={handleClearLearnedPreferences}
              onOpenShareModal={() => setShareModalOpen(true)}
              onBrowseArchetypes={() => setBrowsedArchetypes(true)}
              gentleNudge={
                showGentleNudge && startedFromShared && !nudgeDismissed
                  ? {
                      variant: (hasChattedAfterDup
                        ? "D"
                        : browsedArchetypes
                        ? "B"
                        : "A") as GentleNudgeVariant,
                      onCustomize: () => {
                        setNudgeDismissed(true);
                        setShowGentleNudge(false);
                        scrollToArchetypesAndHighlight();
                      },
                      onDismiss: () => {
                        setNudgeDismissed(true);
                        setShowGentleNudge(false);
                      },
                    }
                  : null
              }
            />
          )}

          {activeTab === "companion" && (
            <LiveCompanionView
              identity={identity}
              userId={user?.uid ?? null}
              guardian={guardian}
              ageTier={guardian.ageTier}
              offlineMode={offlineMode}
              onToggleOffline={() => setOfflineMode((prev) => !prev)}
              onUpdateIdentity={handleUpdateIdentity}
              onUpdateGuardian={handleUpdateGuardian}
              onLogActivity={(summary) => {
                if (startedFromShared) setHasChattedAfterDup(true);
                handleLogActivity(summary, "chat");
              }}
              messages={chatMessages}
              onUpdateMessages={handleUpdateMessages}
              onClearChat={handleClearChat}
              learnedPreferences={learnedPreferences}
              onRateMessage={handleRateMessage}
              memoryContext={
                memoryState.memoryEnabled && memoryContextResult.hasMemory
                  ? memoryContextResult.contextText
                  : undefined
              }
              hasUnreadProactive={hasUnreadProactive}
              proactivePauseOffer={proactivePauseOffer}
              onOpenMemoryViewer={() => setMemoryViewerOpen(true)}
              onMarkProactiveRead={() => setHasUnreadProactive(false)}
              onDismissProactive={handleDismissProactive}
              onRespondPauseProactive={handleRespondPauseProactive}
              onSummarizeSession={handleSummarizeSession}
              memoryUpdatedToast={memoryUpdatedToast}
            />
          )}

          {activeTab === "homework" && showIndustryDesk && (
            <HomeworkLabView
              identity={identity}
              userId={user?.uid ?? null}
              ageTier={guardian.ageTier}
              userName={guardian.displayName}
              offlineMode={offlineMode}
              initialModuleId={activeIndustryModuleId}
              onLogActivity={(summary) => handleLogActivity(summary, "homework")}
            />
          )}

          {activeTab === "journal" && (
            <JournalStoryView
              identity={identity}
              userId={user?.uid ?? null}
              ageTier={guardian.ageTier}
              userName={guardian.displayName}
              offlineMode={offlineMode}
              journals={journals}
              stories={stories}
              onSaveJournal={handleSaveJournal}
              onDeleteJournal={handleDeleteJournal}
              onSaveStory={handleSaveStory}
              onLogActivity={(summary, mode) => handleLogActivity(summary, mode)}
            />
          )}

          {activeTab === "guardian" && (
            <GuardianSettingsView
              guardian={guardian}
              activityLog={activityLog}
              showStudyLab={showStudyLab}
              onUpdateGuardian={handleUpdateGuardian}
              memory={memoryState}
              onToggleMemory={handleToggleMemoryConsent}
              onToggleProactive={handleToggleProactiveConsent}
              onOpenMemoryViewer={() => setMemoryViewerOpen(true)}
            />
          )}
        </ErrorBoundary>
      </main>

      <footer className="border-t border-edge bg-surface py-5 mt-12">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4 text-xs text-ink-muted">
          <span>
            AI Person (AIP) · {identity.studioName || "Kith Studios"} · Private 1-to-1 Companion
          </span>
          <span>
            AI-generated companion replies · No third-party data sharing · Built for all ages
          </span>
        </div>
      </footer>

      <AlwaysOnWidget
        identity={identity}
        ageTier={guardian.ageTier}
        userName={guardian.displayName}
        offlineMode={offlineMode}
        onOpenFullChat={() => setActiveTab("companion")}
        memoryContext={
          memoryState.memoryEnabled && memoryContextResult.hasMemory
            ? memoryContextResult.contextText
            : undefined
        }
        hasUnreadProactive={hasUnreadProactive}
        onOpenProactiveChat={() => {
          setActiveTab("companion");
          window.setTimeout(() => {
            document
              .getElementById("proactive-msg-latest")
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 80);
          setHasUnreadProactive(false);
        }}
      />

      <OnboardingModal
        open={onboardingOpen}
        initialIdentity={identity}
        initialUserName={guardian.displayName}
        onComplete={handleCompleteOnboarding}
        onSkip={handleSkipOnboarding}
      />

      <ResetStudioModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onRerunOnboarding={handleRerunOnboarding}
        onResetAll={handleResetAll}
      />

      <MemoryViewerModal
        open={memoryViewerOpen}
        identity={identity}
        memory={memoryState}
        memorySizeBytes={getMemorySizeBytes()}
        onClose={() => setMemoryViewerOpen(false)}
        onAddFact={handleAddManualFact}
        onDeleteFact={handleDeleteMemoryFact}
        onClearAllMemory={handleClearAllMemory}
        onToggleMemory={handleToggleMemoryConsent}
        onExportJson={exportMemoryJson}
      />

      <ShareModal
        open={shareModalOpen}
        avatarName={identity.primaryName}
        isCustomized={isAvatarCustomized(identity)}
        onClose={() => setShareModalOpen(false)}
        onShare={async () => {
          await copyTextToClipboard(buildShareUrl(identity));
          setShareModalOpen(false);
          triggerStudioToast(APP_COPY.share.actionShare.toast);
        }}
        onCopyData={async () => {
          await copyTextToClipboard(encodeShareDataOnly(identity));
          setShareModalOpen(false);
          triggerStudioToast(APP_COPY.share.actionCopyData.toast);
        }}
        onDuplicate={() => {
          saveLocalCompanion(identity);
          if (typeof window !== "undefined" && window.location.hash) {
            window.history.replaceState(
              null,
              "",
              window.location.pathname + window.location.search
            );
          }
          setShareModalOpen(false);
          triggerStudioToast(APP_COPY.share.actionDuplicate.toast);
        }}
        onCustomizeFirst={() => {
          setShareModalOpen(false);
          scrollToArchetypesAndHighlight();
          triggerStudioToast(APP_COPY.share.emptyState.customizeToast, 3600);
        }}
        onShareAnyway={async () => {
          await copyTextToClipboard(buildShareUrl(identity));
          setShareModalOpen(false);
          triggerStudioToast(APP_COPY.share.emptyState.shareAnywayToast);
        }}
      />

      {studioToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-surface border border-edge-strong shadow-xl text-xs font-medium text-ink flex items-center gap-2 max-w-[90vw]"
        >
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
          />
          <span>{studioToast}</span>
        </div>
      )}
    </div>
  );
}
