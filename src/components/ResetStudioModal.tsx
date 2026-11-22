import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { RotateCcw, Sparkles, Trash2, X } from "lucide-react";

interface ResetStudioModalProps {
  open: boolean;
  onClose: () => void;
  onRerunOnboarding: () => void;
  onResetAll: () => void;
}

export function ResetStudioModal({
  open,
  onClose,
  onRerunOnboarding,
  onResetAll,
}: ResetStudioModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => dialogRef.current?.focus(), 10);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleKeyTrap(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
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
        aria-labelledby="reset-studio-title"
        tabIndex={-1}
        onKeyDown={handleKeyTrap}
        className="w-full max-w-md bg-surface border border-edge rounded-2xl overflow-hidden outline-none shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-accent-ink" />
            <h2 id="reset-studio-title" className="text-base font-semibold text-ink">
              Reset or Re-run Setup
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close reset options"
            onClick={onClose}
            className="p-1 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-xs text-ink-muted leading-relaxed">
            Choose whether to walk through the quick 4-step companion setup again or clear all saved local builds and chats.
          </p>

          <button
            type="button"
            onClick={onRerunOnboarding}
            className="w-full p-3.5 rounded-xl bg-surface-alt border border-edge hover:border-accent text-left transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-ink">
              <Sparkles className="w-3.5 h-3.5 text-accent-ink" />
              Re-run Onboarding Only
            </div>
            <p className="text-[11px] text-ink-muted">
              Re-opens the 4-step guided setup while keeping your current companion look, sliders, and chat history.
            </p>
          </button>

          <button
            type="button"
            onClick={onResetAll}
            className="w-full p-3.5 rounded-xl bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-900 hover:border-red-400 dark:hover:border-red-700 text-left transition-colors cursor-pointer space-y-1"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-red-700 dark:text-red-300">
              <Trash2 className="w-3.5 h-3.5" />
              Reset Everything to Defaults
            </div>
            <p className="text-[11px] text-red-700/80 dark:text-red-300/80">
              Clears saved companion builds, chat history, learned feedback, and re-runs onboarding fresh.
            </p>
          </button>
        </div>

        <div className="px-5 py-3 border-t border-edge bg-surface-alt flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-medium bg-surface border border-edge rounded-lg text-ink-secondary hover:border-edge-strong cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
