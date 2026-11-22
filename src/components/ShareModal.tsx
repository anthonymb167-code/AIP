import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Copy, CopyPlus, Share2, Sparkles, X } from "lucide-react";
import { APP_COPY } from "../lib/copy";

interface ShareModalProps {
  open: boolean;
  avatarName: string;
  isCustomized: boolean;
  onClose: () => void;
  onShare: () => void;
  onCopyData: () => void;
  onDuplicate: () => void;
  onCustomizeFirst: () => void;
  onShareAnyway: () => void;
}

export function ShareModal({
  open,
  avatarName,
  isCustomized,
  onClose,
  onShare,
  onCopyData,
  onDuplicate,
  onCustomizeFirst,
  onShareAnyway,
}: ShareModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
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
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === "function"
      ) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleKeyTrap(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || !dialogRef.current) return;
    const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey) {
      if (
        document.activeElement === first ||
        document.activeElement === dialogRef.current
      ) {
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
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        tabIndex={-1}
        onKeyDown={handleKeyTrap}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface border border-edge rounded-2xl p-6 shadow-2xl outline-none space-y-5"
      >
        {/* Header */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="share-modal-title"
              className="text-base font-semibold text-ink"
            >
              {APP_COPY.share.modalTitle}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close share dialog"
              className="p-1 text-ink-muted hover:text-ink rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-ink-muted leading-relaxed">
            {APP_COPY.share.modalExplainer}
          </p>
        </div>

        {!isCustomized ? (
          /* Empty State: Still matching defaults */
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-surface-alt border border-edge flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-accent-ink shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-semibold text-ink">
                  {APP_COPY.share.emptyState.title}
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  {APP_COPY.share.emptyState.body}
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={onCustomizeFirst}
                className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold transition-colors cursor-pointer"
              >
                {APP_COPY.share.emptyState.primary}
              </button>
              <button
                type="button"
                onClick={onShareAnyway}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-alt border border-edge hover:border-edge-strong text-ink text-sm font-medium transition-colors cursor-pointer"
              >
                {APP_COPY.share.emptyState.secondary}
              </button>
            </div>
          </div>
        ) : (
          /* Full Share State */
          <div className="space-y-4">
            {/* Action 1: Share this avatar */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onShare}
                className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-accent-fg text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                {APP_COPY.share.actionShare.label}
              </button>
              <p className="text-[11px] text-ink-muted leading-snug">
                {APP_COPY.share.actionShare.helperPrefix}{" "}
                <span className="font-medium text-ink">{avatarName}</span>{" "}
                {APP_COPY.share.actionShare.helperSuffix}
              </p>
            </div>

            {/* Action 2: Copy avatar data */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onCopyData}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-alt border border-edge hover:border-edge-strong text-ink text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4 text-ink-muted" />
                {APP_COPY.share.actionCopyData.label}
              </button>
              <p className="text-[11px] text-ink-muted leading-snug">
                {APP_COPY.share.actionCopyData.helper}
              </p>
            </div>

            {/* Action 3: Duplicate this avatar */}
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={onDuplicate}
                className="w-full py-2.5 px-4 rounded-xl bg-accent-soft border border-accent/35 hover:border-accent text-accent-ink text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CopyPlus className="w-4 h-4" />
                {APP_COPY.share.actionDuplicate.label}
              </button>
              <p className="text-[11px] text-ink-muted leading-snug">
                {APP_COPY.share.actionDuplicate.helper}
              </p>
            </div>
          </div>
        )}

        {/* Privacy Footnote */}
        <div className="pt-3 border-t border-edge flex items-center gap-2 text-[11px] text-ink-muted">
          <span
            aria-hidden="true"
            className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
          />
          <span>{APP_COPY.share.privacyFootnote}</span>
        </div>
      </div>
    </div>
  );
}
