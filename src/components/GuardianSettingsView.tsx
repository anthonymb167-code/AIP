import { Shield, Lock, Clock, Brain, Sparkles } from "lucide-react";
import type {
  ActivityLogItem,
  AgeTier,
  CompanionMemoryState,
  UserGuardianProfile,
} from "../types/kith";

interface GuardianSettingsViewProps {
  guardian: UserGuardianProfile;
  activityLog: ActivityLogItem[];
  showStudyLab?: boolean;
  onUpdateGuardian: (next: UserGuardianProfile) => void;
  memory?: CompanionMemoryState;
  onToggleMemory?: (enabled: boolean) => void;
  onToggleProactive?: (enabled: boolean) => void;
  onOpenMemoryViewer?: () => void;
}

const AGE_TIERS: { id: AgeTier; label: string; desc: string }[] = [
  {
    id: "all_ages",
    label: "All Ages (6–12)",
    desc: "Wholesome, gentle stories, encouraging vocabulary, and strict child-safe framing.",
  },
  {
    id: "teen",
    label: "Teen (13–17)",
    desc: "Teen literature, deep conversation, and thoughtful guidance with age-safe filters.",
  },
  {
    id: "adult",
    label: "Adult / General (18+)",
    desc: "Full literary, philosophical, and practical depth while maintaining Kith's incorruptible core.",
  },
];

export function GuardianSettingsView({
  guardian,
  activityLog,
  showStudyLab = false,
  onUpdateGuardian,
  memory,
  onToggleMemory,
  onToggleProactive,
  onOpenMemoryViewer,
}: GuardianSettingsViewProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Settings Panel */}
      <div className="lg:col-span-6 bg-surface border border-edge rounded-2xl p-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              Parent &amp; Guardian Controls
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              Transparent safety boundaries with zero third-party data sharing.
            </p>
          </div>
          <Shield className="w-5 h-5 text-accent-ink shrink-0" />
        </div>

        {/* Age-Appropriate Content Filters */}
        <div className="space-y-2.5">
          <div className="text-xs font-semibold text-ink-secondary">
            Age-Appropriate Content Filter
          </div>
          <div className="space-y-2">
            {AGE_TIERS.map((tier) => {
              const active = guardian.ageTier === tier.id;
              return (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() =>
                    onUpdateGuardian({ ...guardian, ageTier: tier.id })
                  }
                  className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                    active
                      ? "bg-accent-soft border-accent"
                      : "bg-surface-alt border-edge hover:border-edge-strong"
                  }`}
                >
                  <div className="text-sm font-semibold text-ink">
                    {tier.label}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">{tier.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Daily Time Limit */}
        <div className="space-y-2 pt-2 border-t border-edge">
          <div className="flex items-center justify-between text-xs">
            <label htmlFor="daily-limit-slider" className="font-medium text-ink-secondary">
              Daily Companion Time Limit
            </label>
            <span className="font-mono-tabular font-semibold text-ink">
              {guardian.dailyLimitMinutes} min / day
            </span>
          </div>
          <input
            id="daily-limit-slider"
            type="range"
            min={15}
            max={240}
            step={15}
            value={guardian.dailyLimitMinutes}
            onChange={(e) =>
              onUpdateGuardian({
                ...guardian,
                dailyLimitMinutes: Number(e.target.value),
              })
            }
            className="w-full kith-slider"
          />
          <div className="flex items-center justify-between text-xs text-ink-muted">
            <span>Used today:</span>
            <span className="font-mono-tabular">
              {guardian.minutesUsedToday} / {guardian.dailyLimitMinutes} min
            </span>
          </div>
        </div>

        {/* Guardian PIN Lock Toggle */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-edge">
          <div className="flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-accent-ink mt-0.5 shrink-0" />
            <div>
              <div className="text-sm font-medium text-ink">
                Guardian Settings Lock
              </div>
              <div className="text-xs text-ink-muted">
                Mark these preferences as guardian-managed for younger readers.
              </div>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={guardian.guardianPinEnabled}
            onClick={() =>
              onUpdateGuardian({
                ...guardian,
                guardianPinEnabled: !guardian.guardianPinEnabled,
              })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              guardian.guardianPinEnabled ? "bg-accent" : "bg-edge-strong"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                guardian.guardianPinEnabled ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Companion Memory & Proactive Presence Controls */}
        {memory && onToggleMemory && onToggleProactive && (
          <div className="space-y-4 pt-3 border-t border-edge">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-accent-ink shrink-0" />
                <div>
                  <div className="text-sm font-medium text-ink">
                    Companion Memory &amp; Proactive Presence
                  </div>
                  <div className="text-xs text-ink-muted">
                    {memory.facts.length} facts · {memory.sessions.length} past sessions stored locally
                  </div>
                </div>
              </div>
              {onOpenMemoryViewer && (
                <button
                  type="button"
                  onClick={onOpenMemoryViewer}
                  className="px-3 py-1.5 text-xs font-medium bg-surface-alt border border-edge rounded-lg text-ink hover:border-edge-strong cursor-pointer whitespace-nowrap shrink-0"
                >
                  View &amp; Edit Memory
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-ink-secondary">
                  Cross-Session Memory
                </div>
                <div className="text-[11px] text-ink-muted">
                  Remember goals, preferences, and summaries between visits. Turning off stops new writes and prompt injection.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Cross-Session Memory"
                aria-checked={memory.memoryEnabled}
                onClick={() => onToggleMemory(!memory.memoryEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  memory.memoryEnabled ? "bg-accent" : "bg-edge-strong"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    memory.memoryEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-ink-secondary inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
                  Proactive Check-Ins
                </div>
                <div className="text-[11px] text-ink-muted">
                  {memory.memoryEnabled
                    ? "Gentle follow-ups on open goals after time away (capped at 2 per day)."
                    : "Requires Cross-Session Memory to be turned on."}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-label="Proactive Check-Ins"
                disabled={!memory.memoryEnabled}
                aria-checked={memory.proactiveEnabled}
                onClick={() => onToggleProactive(!memory.proactiveEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  !memory.memoryEnabled
                    ? "bg-edge opacity-45 cursor-not-allowed"
                    : memory.proactiveEnabled
                    ? "bg-accent cursor-pointer"
                    : "bg-edge-strong cursor-pointer"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    memory.proactiveEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-surface-alt border border-edge text-xs text-ink-secondary leading-relaxed space-y-1.5">
          <p>
            <span className="font-semibold text-ink">Privacy Commitment:</span>{" "}
            Zero data is sold or shared with third parties. Journal entries, activity summaries, and companion memory stay strictly inside your personal account and local device storage.
          </p>
          <p className="text-[11px] text-ink-muted">
            Responses are AI-generated using your selected archetype, focus balance, and local memory context.
          </p>
        </div>
      </div>

      {/* Right Transparent Activity Summary */}
      <div className="lg:col-span-6 bg-surface border border-edge rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              Transparent Activity Summary
            </h3>
            <p className="text-xs text-ink-muted">
              Clear, non-intrusive overview of {showStudyLab ? "study, storytime, and studio" : "companion, storytime, and studio"} sessions.
            </p>
          </div>
          <Clock className="w-4 h-4 text-accent-ink" />
        </div>

        {activityLog.length === 0 ? (
          <div className="p-6 rounded-xl bg-surface-alt border border-edge text-center text-xs text-ink-muted">
            Sessions from {showStudyLab ? "Study Lab, " : ""}Live Companion, Storytime, and Identity Studio will appear here transparently.
          </div>
        ) : (
          <div className="divide-y divide-edge border border-edge rounded-xl overflow-hidden">
            {activityLog.slice(0, 12).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-xs bg-surface"
              >
                <div className="min-w-0">
                  <div className="font-medium text-ink truncate">
                    {item.summary}
                  </div>
                  <div className="text-ink-muted mt-0.5 capitalize">
                    {item.mode} ·{" "}
                    <span className="font-mono-tabular">
                      {new Date(item.createdAtIso).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
                <span className="font-mono-tabular text-accent-ink font-medium whitespace-nowrap">
                  {item.durationMinutes} min
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
