import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  Brain,
  Download,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  AGE_BAND_PROFILES,
  ARCHETYPES,
  INDUSTRIES,
  type CompanionIdentity,
  type CompanionMemoryState,
  type MemoryFactCategory,
} from "../types/kith";

interface MemoryViewerModalProps {
  open: boolean;
  identity: CompanionIdentity;
  memory: CompanionMemoryState;
  memorySizeBytes: number;
  onClose: () => void;
  onAddFact: (category: MemoryFactCategory, value: string) => void;
  onDeleteFact: (factId: string) => void;
  onClearAllMemory: () => void;
  onToggleMemory: (enabled: boolean) => void;
  onExportJson: () => string;
}

const FACT_CATEGORIES: { id: MemoryFactCategory; label: string }[] = [
  { id: "goal", label: "Goal" },
  { id: "project", label: "Project" },
  { id: "preference", label: "Preference" },
  { id: "worry", label: "Worry / Pressure" },
  { id: "person", label: "Person in Life" },
];

export function MemoryViewerModal({
  open,
  identity,
  memory,
  memorySizeBytes,
  onClose,
  onAddFact,
  onDeleteFact,
  onClearAllMemory,
  onToggleMemory,
  onExportJson,
}: MemoryViewerModalProps) {
  const [newCategory, setNewCategory] = useState<MemoryFactCategory>("goal");
  const [newValue, setNewValue] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfirmClear(false);
    const timer = window.setTimeout(() => dialogRef.current?.focus(), 10);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeKb = (memorySizeBytes / 1024).toFixed(1);
  const recentSessions = [...memory.sessions].reverse().slice(0, 5);
  const seed = memory.identitySeed;

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

  function handleDownloadJson() {
    const json = onExportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aip-memory-${(identity.primaryName || "companion").toLowerCase().replace(/[^a-z0-9]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleSubmitFact() {
    const clean = newValue.trim();
    if (!clean) return;
    onAddFact(newCategory, clean);
    setNewValue("");
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-viewer-title"
        tabIndex={-1}
        onKeyDown={handleKeyTrap}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[88vh] flex flex-col bg-surface border border-edge rounded-2xl overflow-hidden outline-none shadow-2xl"
      >
        <div className="px-6 py-4 border-b border-edge flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <Brain className="w-4 h-4 text-accent-ink shrink-0" />
            <div className="min-w-0">
              <h2
                id="memory-viewer-title"
                className="text-base font-semibold text-ink truncate"
              >
                What {identity.primaryName} Remembers
              </h2>
              <p className="text-[11px] text-ink-muted font-mono-tabular">
                Memory size: ~{sizeKb} KB · {memory.facts.length} facts · {memory.sessions.length} sessions
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close memory viewer"
            onClick={onClose}
            className="p-1.5 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Consent Status */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-surface-alt border border-edge">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-ink">
                Cross-Session Memory
              </div>
              <p className="text-[11px] text-ink-muted mt-0.5">
                {memory.memoryEnabled
                  ? "On — conversations are summarized privately on this device to build continuity."
                  : "Off — paused. No new memories are saved or injected, while existing data stays intact."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
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

          {/* 1. Identity Seed */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-ink-secondary">
              Identity Baseline
            </h3>
            <div className="p-3.5 rounded-xl bg-surface-alt border border-edge text-xs text-ink-secondary space-y-1">
              {seed ? (
                <>
                  <div className="font-medium text-ink">
                    {seed.primaryName} · {ARCHETYPES[seed.archetype]?.label || seed.archetype}
                  </div>
                  <div className="text-ink-muted">
                    Age band {AGE_BAND_PROFILES[seed.ageBand]?.shortLabel || seed.ageBand} ·{" "}
                    {INDUSTRIES[seed.industry]?.label || seed.industry}
                  </div>
                  {seed.onboardingNote && (
                    <div className="text-ink-muted italic">
                      Note: “{seed.onboardingNote}”
                    </div>
                  )}
                </>
              ) : (
                <div className="text-ink-muted">
                  {identity.primaryName} · {ARCHETYPES[identity.archetype].label} (recorded on first session)
                </div>
              )}
            </div>
          </div>

          {/* 2. Editable / Deletable Facts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-ink-secondary">
                Remembered Facts &amp; Preferences
              </h3>
              <span className="text-[11px] text-ink-muted font-mono-tabular">
                {memory.facts.length} stored
              </span>
            </div>

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <select
                aria-label="Fact category"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as MemoryFactCategory)}
                className="px-2.5 py-1.5 text-xs bg-surface-alt border border-edge rounded-lg text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {FACT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                maxLength={160}
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmitFact();
                  }
                }}
                placeholder="Teach a fact or preference (e.g., Prefer brief answers)..."
                className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                disabled={!newValue.trim()}
                onClick={handleSubmitFact}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </button>
            </div>

            {memory.facts.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface-alt border border-edge text-xs text-ink-muted">
                No personal facts recorded yet. Have a conversation of 3+ turns or add a preference above.
              </div>
            ) : (
              <div className="divide-y divide-edge border border-edge rounded-xl overflow-hidden">
                {memory.facts.map((fact) => (
                  <div
                    key={fact.id}
                    className="flex items-start justify-between gap-3 px-3.5 py-2.5 bg-surface text-xs"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-accent-ink capitalize">
                        {fact.category} · scope: {fact.personaRelevance}
                      </div>
                      <p className="text-ink mt-0.5 leading-relaxed">{fact.value}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete fact: ${fact.value}`}
                      onClick={() => onDeleteFact(fact.id)}
                      className="p-1 text-ink-muted hover:text-red-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[11px] text-ink-muted">
              Deleted facts are immediately excluded from future conversations, while past session summaries remain in history below until cleared.
            </p>
          </div>

          {/* 3. Recent Session Summaries (last 5) */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-semibold text-ink-secondary">
              Recent Sessions (Showing Latest 5)
            </h3>
            {recentSessions.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface-alt border border-edge text-xs text-ink-muted">
                No past session summaries yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recentSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3.5 rounded-xl bg-surface-alt border border-edge space-y-1.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
                      <span className="font-semibold text-ink">
                        {sess.personaLabel} · {sess.topics.join(" / ") || "Conversation"}
                      </span>
                      <span className="font-mono-tabular">
                        {new Date(sess.dateIso).toLocaleDateString()} · {sess.emotionalTone}
                      </span>
                    </div>
                    <p className="text-ink-secondary leading-relaxed">{sess.summary}</p>
                    {sess.openLoops.length > 0 && (
                      <div className="text-[11px] text-accent-ink">
                        Follow-up thread: {sess.openLoops.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-edge bg-surface-alt flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON
            </button>

            {!confirmClear ? (
              <button
                type="button"
                disabled={memory.facts.length === 0 && memory.sessions.length === 0 && !memory.identitySeed}
                onClick={() => setConfirmClear(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-surface border border-edge rounded-lg hover:border-red-400 disabled:opacity-40 cursor-pointer whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Memory
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllMemory();
                    setConfirmClear(false);
                  }}
                  className="px-2.5 py-1.5 text-xs font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer whitespace-nowrap"
                >
                  Confirm Wipe
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="px-2 py-1.5 text-xs text-ink-muted hover:text-ink cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-ink-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-ink" />
              Stored privately on device
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
