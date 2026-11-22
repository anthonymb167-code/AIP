import { useEffect, useRef, useState } from "react";
import { Brain, Heart, HelpCircle, Lock, Scale, ShieldCheck, Sparkles, X } from "lucide-react";
import {
  AGE_BAND_PROFILES,
  computeFocusWeights,
  type AgeBandId,
  type FocusDimensionKey,
  type MaturityMode,
} from "../types/kith";

interface FocusBalanceCardProps {
  ageBand: AgeBandId;
  warmthHumor: number;
  scholarlyDepth: number;
  companionName: string;
  maturityMode?: MaturityMode;
}

const DIMENSIONS: {
  key: FocusDimensionKey;
  label: string;
  barClass: string;
  badgeClass: string;
  hint: string;
  Icon: typeof ShieldCheck;
}[] = [
  {
    key: "trust",
    label: "Trust & Safety",
    barClass: "bg-emerald-600 dark:bg-emerald-500",
    badgeClass:
      "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/60 dark:border-emerald-800/70",
    hint: "Incorruptible loyalty & calm boundaries",
    Icon: ShieldCheck,
  },
  {
    key: "intellect",
    label: "Intellectual Sharpness",
    barClass: "bg-cyan-600 dark:bg-cyan-400",
    badgeClass:
      "text-cyan-700 bg-cyan-50 border-cyan-200 dark:text-cyan-300 dark:bg-cyan-950/60 dark:border-cyan-800/70",
    hint: "Logic, literature, & problem solving",
    Icon: Brain,
  },
  {
    key: "attunement",
    label: "Emotional Attunement",
    barClass: "bg-amber-600 dark:bg-amber-400",
    badgeClass:
      "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/60 dark:border-amber-800/70",
    hint: "Reads mood & paces responses",
    Icon: Heart,
  },
  {
    key: "personality",
    label: "Playful Personality",
    barClass: "bg-purple-600 dark:bg-purple-400",
    badgeClass:
      "text-purple-700 bg-purple-50 border-purple-200 dark:text-purple-300 dark:bg-purple-950/60 dark:border-purple-800/70",
    hint: "Dry wit, warmth, & signature smirk",
    Icon: Sparkles,
  },
];

const EXPLAINER_STORAGE_KEY = "aip_focus_explainer_seen";

export function FocusExplainerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="focus-explainer-title"
    >
      <div className="w-full max-w-lg bg-surface border border-edge rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between gap-4">
          <div>
            <h3
              id="focus-explainer-title"
              className="text-base font-semibold text-ink"
            >
              How Adaptive Focus Balance Works
            </h3>
            <p className="text-xs text-ink-muted mt-0.5">
              One incorruptible companion calibrated across every decade of life.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close explainer"
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-alt cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs text-ink-secondary leading-relaxed">
          <p>
            Every AI Person runs on four live priorities totaling{" "}
            <span className="font-semibold text-ink">100%</span>. Changing your{" "}
            <span className="font-semibold text-ink">Age Band</span> or adjusting{" "}
            <span className="font-semibold text-ink">Warmth &amp; Depth</span>{" "}
            sliders rebalances these weights immediately:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DIMENSIONS.map((dim) => {
              const Icon = dim.Icon;
              return (
                <div
                  key={dim.key}
                  className="p-3 rounded-xl bg-surface-alt border border-edge flex items-start gap-2.5"
                >
                  <Icon className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-ink">{dim.label}</div>
                    <div className="text-[11px] text-ink-muted mt-0.5">{dim.hint}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-700/60 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              Hard Safety Guardrails
            </div>
            <ul className="space-y-1 text-[11px] text-ink-secondary list-disc pl-4">
              <li>
                <span className="font-medium text-ink">Child (0–10):</span>{" "}
                Trust &amp; Safety is locked at or above 40%.
              </li>
              <li>
                <span className="font-medium text-ink">Senior (61+):</span>{" "}
                Emotional Attunement is locked at or above 24%.
              </li>
              <li>
                <span className="font-medium text-ink">All Ages:</span>{" "}
                Trust &amp; Safety never drops below 25%, and Playful Personality is capped at 25% so wit never overshadows clarity.
              </li>
            </ul>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-surface-alt border-t border-edge flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Got it, continue building
          </button>
        </div>
      </div>
    </div>
  );
}

export function FocusBalanceCard({
  ageBand,
  warmthHumor,
  scholarlyDepth,
  companionName,
  maturityMode = "maturing",
}: FocusBalanceCardProps) {
  const [explainerOpen, setExplainerOpen] = useState(false);
  const [inspectedLock, setInspectedLock] = useState<FocusDimensionKey | null>(null);
  const [shiftNotice, setShiftNotice] = useState<string | null>(null);
  const prevAgeBandRef = useRef<AgeBandId>(ageBand);

  const profile = AGE_BAND_PROFILES[ageBand] || AGE_BAND_PROFILES["11-20"];
  const { weights, clamps } = computeFocusWeights(
    ageBand,
    warmthHumor,
    scholarlyDepth,
    maturityMode
  );

  useEffect(() => {
    if (prevAgeBandRef.current !== ageBand) {
      prevAgeBandRef.current = ageBand;
      if (maturityMode === "maturing") {
        const dominant = DIMENSIONS.reduce((best, cur) =>
          weights[cur.key] > weights[best.key] ? cur : best
        );
        setShiftNotice(
          `Maturing with you: focus shifted toward ${dominant.label} (${weights[dominant.key]}%).`
        );
        const timer = window.setTimeout(() => setShiftNotice(null), 3200);
        return () => window.clearTimeout(timer);
      }
      setShiftNotice(null);
    }
    return undefined;
  }, [ageBand, maturityMode, weights]);

  function handleDismissExplainer() {
    setExplainerOpen(false);
    try {
      localStorage.setItem(EXPLAINER_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }

  const activeClamp = inspectedLock
    ? clamps.find((c) => c.key === inspectedLock) || null
    : clamps[0] || null;

  return (
    <>
      <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-accent-ink shrink-0" />
              <h3 className="text-base font-semibold text-ink">
                Adaptive Focus Balance
              </h3>
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {maturityMode === "timeless"
                ? `Timeless anchor weighting for ${companionName} (holds steady across decades).`
                : `Live priority weighting guiding ${companionName} for age band `}
              {maturityMode !== "timeless" && (
                <span className="font-semibold text-ink">{profile.shortLabel}</span>
              )}
              {maturityMode !== "timeless" ? "." : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExplainerOpen(true)}
            title="How Focus Balance works"
            aria-label="How Focus Balance works"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:border-edge-strong border border-transparent transition-colors shrink-0 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Guide</span>
          </button>
        </div>

        {shiftNotice && (
          <div className="px-3 py-2 rounded-lg bg-accent-soft border border-accent text-[11px] font-medium text-accent-ink">
            {shiftNotice}
          </div>
        )}

        {/* 100% Stacked Distribution Bar */}
        <div
          className="h-3.5 w-full rounded-full overflow-hidden flex bg-surface-alt"
          aria-label="Focus weights distribution bar"
        >
          {DIMENSIONS.map((dim) => {
            const pct = weights[dim.key];
            const isLocked = clamps.some((c) => c.key === dim.key);
            return (
              <div
                key={dim.key}
                style={{ width: `${pct}%` }}
                title={`${dim.label}: ${pct}%${isLocked ? " (Guardrail Locked)" : ""}`}
                className={`${dim.barClass} h-full transition-all duration-400 ease-out motion-reduce:transition-none flex items-center justify-center`}
              >
                {isLocked && pct >= 12 && (
                  <Lock className="w-2.5 h-2.5 text-slate-950/90 dark:text-slate-950/90" />
                )}
              </div>
            );
          })}
        </div>

        {/* Four Weighted Dimensions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {DIMENSIONS.map((dim) => {
            const pct = weights[dim.key];
            const clampInfo = clamps.find((c) => c.key === dim.key);
            const Icon = dim.Icon;
            return (
              <div
                key={dim.key}
                className="p-3 rounded-xl bg-surface-alt border border-edge flex items-start justify-between gap-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-accent-ink shrink-0" />
                    <span className="text-xs font-semibold text-ink truncate">
                      {dim.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-muted mt-0.5">{dim.hint}</p>
                  {clampInfo && (
                    <button
                      type="button"
                      onClick={() => setInspectedLock(clampInfo.key)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      <span>
                        Guardrail {clampInfo.boundType === "floor" ? "≥" : "≤"}{" "}
                        {clampInfo.limit}%
                      </span>
                    </button>
                  )}
                </div>
                <span
                  className={`font-mono-tabular text-xs font-semibold px-2 py-0.5 rounded-md border shrink-0 ${dim.badgeClass}`}
                >
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>

        {/* Age Band Profile Summary + Guardrail Note */}
        <div className="pt-3 border-t border-edge space-y-2 text-xs">
          <div className="text-ink-secondary leading-relaxed">
            <span className="font-semibold text-ink">
              Age Band Leaning ({profile.primaryFocus}):
            </span>{" "}
            {profile.leaningNote}
          </div>

          {activeClamp ? (
            <div className="p-2.5 rounded-lg bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex items-start gap-2 text-[11px] text-amber-900 dark:text-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>{activeClamp.reason}</span>
            </div>
          ) : (
            <div className="text-[11px] text-ink-muted">
              Guardrails active: Trust &amp; Safety stays ≥{" "}
              {ageBand === "0-10" ? "40%" : "25%"}
              {ageBand === "61+" ? ", Emotional Attunement stays ≥ 24%" : ""}, and Playful Personality stays ≤ 25%.
            </div>
          )}
        </div>
      </div>

      <FocusExplainerModal
        open={explainerOpen}
        onClose={handleDismissExplainer}
      />
    </>
  );
}
