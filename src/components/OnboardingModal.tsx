import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import {
  AGE_BAND_ORDER,
  AGE_BAND_PROFILES,
  ARCHETYPES,
  GENDER_OPTIONS,
  INDUSTRIES,
  INDUSTRY_ORDER,
  STUDIO_NAME_PRESETS,
  type AgeBandId,
  type AgeTier,
  type ArchetypeId,
  type CompanionGender,
  type CompanionIdentity,
  type IndustryId,
} from "../types/kith";

interface OnboardingModalProps {
  open: boolean;
  initialIdentity: CompanionIdentity;
  initialUserName: string;
  onComplete: (
    nextIdentity: CompanionIdentity,
    nextUserName: string,
    nextAgeTier: AgeTier,
    options?: { memoryEnabled: boolean; note?: string }
  ) => void;
  onSkip: () => void;
}

const TOTAL_STEPS = 4;

function ageBandToTier(ageBand: AgeBandId): AgeTier {
  if (ageBand === "0-10") return "all_ages";
  if (ageBand === "11-20") return "teen";
  return "adult";
}

export function OnboardingModal({
  open,
  initialIdentity,
  initialUserName,
  onComplete,
  onSkip,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const [userName, setUserName] = useState(initialUserName || "Reader");
  const [draft, setDraft] = useState<CompanionIdentity>(initialIdentity);
  const [rememberConversations, setRememberConversations] = useState(true);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setStep(0);
    setDraft(initialIdentity);
    setUserName(initialUserName || "Reader");

    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus();
    }, 10);

    return () => {
      window.clearTimeout(focusTimer);
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [open, initialIdentity, initialUserName]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onSkip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onSkip]);

  if (!open) return null;

  const gender: CompanionGender = draft.gender || "masculine";
  const selectedIndustry: IndustryId = draft.selectedIndustry || "NONE";
  const industrySpec = INDUSTRIES[selectedIndustry] || INDUSTRIES.NONE;
  const enabledModules = draft.enabledIndustryModules || [];
  const activeAgeBand: AgeBandId = draft.userAgeBand || "11-20";
  const ageProfile = AGE_BAND_PROFILES[activeAgeBand] || AGE_BAND_PROFILES["11-20"];

  function handleSelectArchetype(archId: ArchetypeId) {
    const spec = ARCHETYPES[archId];
    setDraft((prev) => ({
      ...prev,
      archetype: archId,
      primaryName: spec.selfChosenNameByGender[prev.gender || "masculine"],
      nicknames: spec.defaultNicknames,
      activeNickname: spec.defaultNicknames[0] || "",
      coatLayering: spec.defaultSliders.coatLayering,
      hairLength: spec.defaultSliders.hairLength,
      accessoryDetail: spec.defaultSliders.accessoryDetail,
      warmthHumor: spec.defaultSliders.warmthHumor,
      scholarlyDepth: spec.defaultSliders.scholarlyDepth,
      voiceTone: spec.defaultSliders.voiceTone,
    }));
  }

  function handleSelectGender(nextGender: CompanionGender) {
    const spec = ARCHETYPES[draft.archetype];
    setDraft((prev) => ({
      ...prev,
      gender: nextGender,
      primaryName: spec.selfChosenNameByGender[nextGender],
    }));
  }

  function handleFinish() {
    const cleanName = userName.trim() || "Reader";
    const resolvedAgeTier = ageBandToTier(activeAgeBand);
    onComplete(draft, cleanName, resolvedAgeTier, {
      memoryEnabled: rememberConversations,
    });
  }

  function handleKeyTrap(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || document.activeElement === dialogRef.current) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        onKeyDown={handleKeyTrap}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface border border-edge rounded-2xl overflow-hidden outline-none shadow-2xl"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono-tabular font-semibold text-accent-ink">
              Step {step + 1} of {TOTAL_STEPS}
            </span>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === step
                      ? "w-6 bg-accent"
                      : idx < step
                      ? "w-3 bg-accent/60"
                      : "w-3 bg-edge-strong"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs font-medium text-ink-muted hover:text-ink cursor-pointer whitespace-nowrap"
            >
              Skip setup
            </button>
            <button
              type="button"
              aria-label="Close onboarding setup"
              onClick={onSkip}
              className="p-1 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Polite Screen Reader Step Announcement */}
        <div className="sr-only" aria-live="polite">
          Onboarding step {step + 1} of {TOTAL_STEPS}
        </div>

        {/* Scrollable Step Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {step === 0 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-ink">
                  <Sparkles className="w-3.5 h-3.5" />
                  Welcome to AI Person (AIP)
                </div>
                <h2
                  id="onboarding-title"
                  className="text-2xl font-semibold tracking-tight text-ink"
                >
                  Build a 1-to-1 companion who stays in your corner
                </h2>
                <p className="text-sm text-ink-muted leading-relaxed">
                  Customize their archetype, age-balanced voice, surroundings, and soundtrack. Only the modules you actually need appear on your studio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="onboarding-user-name"
                    className="block text-xs font-medium text-ink-secondary"
                  >
                    What should your companion call you?
                  </label>
                  <input
                    id="onboarding-user-name"
                    type="text"
                    maxLength={80}
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="Your name..."
                    className="w-full px-3.5 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="onboarding-studio-name"
                    className="block text-xs font-medium text-ink-secondary"
                  >
                    Studio Subtitle
                  </label>
                  <select
                    id="onboarding-studio-name"
                    value={
                      STUDIO_NAME_PRESETS.includes(draft.studioName)
                        ? draft.studioName
                        : "Kith Studios"
                    }
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, studioName: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {STUDIO_NAME_PRESETS.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface-alt border border-edge flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
                <div className="text-xs text-ink-muted leading-relaxed">
                  <span className="font-semibold text-ink">Core Anchors Locked:</span>{" "}
                  Incorruptible loyalty, sharp intellect, encouraging honesty, and strict age-band safety floors stay enforced automatically.
                </div>
              </div>

              <label className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-alt border border-edge cursor-pointer hover:border-edge-strong transition-colors">
                <input
                  type="checkbox"
                  checked={rememberConversations}
                  onChange={(e) => setRememberConversations(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-edge-strong accent-[var(--aip-accent)] cursor-pointer shrink-0"
                />
                <div className="text-xs leading-relaxed">
                  <div className="font-semibold text-ink">
                    Remember conversations across sessions
                  </div>
                  <div className="text-ink-muted">
                    Store private summaries on your device so your companion remembers your goals and follows up naturally. You can edit, export, or wipe memory anytime.
                  </div>
                </div>
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2
                  id="onboarding-title"
                  className="text-xl font-semibold tracking-tight text-ink"
                >
                  Choose an archetype &amp; voice presence
                </h2>
                <p className="text-xs text-ink-muted mt-1">
                  Pick the visual style and temperament you want to start from—every detail stays editable later.
                </p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(Object.keys(ARCHETYPES) as ArchetypeId[]).map((archId) => {
                  const spec = ARCHETYPES[archId];
                  const selected = draft.archetype === archId;
                  return (
                    <button
                      key={archId}
                      type="button"
                      onClick={() => handleSelectArchetype(archId)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? "bg-accent-soft border-accent"
                          : "bg-surface-alt border-edge hover:border-edge-strong"
                      }`}
                    >
                      <img
                        src={spec.portraitUrl}
                        alt={spec.label}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-lg object-cover shrink-0 bg-[#090D16] border border-edge"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-ink truncate">
                            {spec.label}
                          </span>
                          {selected && <Check className="w-3.5 h-3.5 text-accent-ink shrink-0" />}
                        </div>
                        <p className="text-[11px] text-ink-muted line-clamp-2 mt-0.5">
                          {spec.tagline}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2
                  id="onboarding-title"
                  className="text-xl font-semibold tracking-tight text-ink"
                >
                  Select your age band &amp; life focus
                </h2>
                <p className="text-xs text-ink-muted mt-1">
                  Sets the right tone, pacing, and deterministic Trust &amp; Attunement safety floors.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AGE_BAND_ORDER.map((bandId) => {
                  const band = AGE_BAND_PROFILES[bandId];
                  const selected = activeAgeBand === bandId;
                  return (
                    <button
                      key={bandId}
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({ ...prev, userAgeBand: bandId }))
                      }
                      className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                        selected
                          ? "bg-accent text-accent-fg border-accent"
                          : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
                      }`}
                    >
                      <div className="font-mono-tabular text-xs font-bold">
                        {band.shortLabel}
                      </div>
                      <div className="text-[11px] opacity-85 mt-0.5 line-clamp-1">
                        {band.primaryFocus}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-4 rounded-xl bg-surface-alt border border-edge space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-ink">
                    {ageProfile.label}
                  </span>
                  <span className="text-[11px] font-medium text-accent-ink">
                    Secondary: {ageProfile.secondaryFocus}
                  </span>
                </div>
                <p className="text-xs text-ink-muted leading-relaxed">
                  {ageProfile.embodiment}
                </p>
                <p className="text-[11px] text-ink-muted">{ageProfile.leaningNote}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2
                  id="onboarding-title"
                  className="text-xl font-semibold tracking-tight text-ink"
                >
                  Optional context &amp; specialized modules
                </h2>
                <p className="text-xs text-ink-muted mt-1">
                  Your four universal modules (Everyday Ally, Creative Ally, Mindfulness, Growth &amp; Skills) are always included. Pick an industry only if you want extra dedicated tools.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="onboarding-industry-select"
                  className="block text-xs font-medium text-ink-secondary"
                >
                  Industry / Role Context
                </label>
                <select
                  id="onboarding-industry-select"
                  value={selectedIndustry}
                  onChange={(e) => {
                    const nextInd = e.target.value as IndustryId;
                    setDraft((prev) => ({
                      ...prev,
                      selectedIndustry: nextInd,
                      enabledIndustryModules:
                        nextInd === "NONE" ? [] : prev.enabledIndustryModules || [],
                    }));
                  }}
                  className="w-full px-3.5 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {INDUSTRY_ORDER.map((indId) => (
                    <option key={indId} value={indId}>
                      {INDUSTRIES[indId].label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-ink-muted">{industrySpec.tagline}</p>
              </div>

              {industrySpec.modules.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-edge">
                  <div className="text-xs font-medium text-ink-secondary">
                    Choose optional {industrySpec.label} modules to unlock:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {industrySpec.modules.map((mod) => {
                      const active = enabledModules.includes(mod.id);
                      return (
                        <button
                          key={mod.id}
                          type="button"
                          onClick={() => {
                            const next = active
                              ? enabledModules.filter((id) => id !== mod.id)
                              : [...enabledModules, mod.id];
                            setDraft((prev) => ({
                              ...prev,
                              enabledIndustryModules: next,
                            }));
                          }}
                          className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? "bg-accent-soft border-accent text-ink"
                              : "bg-surface-alt border-edge text-ink-secondary hover:border-edge-strong"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold">{mod.label}</span>
                            {active && <Check className="w-3.5 h-3.5 text-accent-ink shrink-0" />}
                          </div>
                          <p className="text-[11px] text-ink-muted mt-0.5">{mod.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-edge bg-surface-alt flex items-center justify-between gap-3">
          <div>
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-surface border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            ) : (
              <span className="text-[11px] text-ink-muted">
                Saved privately in your studio
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(TOTAL_STEPS - 1, s + 1))}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
              >
                Continue
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
              >
                Enter Studio
                <Check className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
