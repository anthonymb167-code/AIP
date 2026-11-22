import { useState } from "react";
import { X, MessageCircle, Smile, Send } from "lucide-react";
import {
  getOfflineCompanionReply,
  type AgeTier,
  type CompanionIdentity,
  type GestureId,
} from "../types/kith";
import { LiveRigSvg } from "./CompanionStageAvatar";

interface AlwaysOnWidgetProps {
  identity: CompanionIdentity;
  ageTier: AgeTier;
  userName: string;
  offlineMode: boolean;
  onOpenFullChat: () => void;
  memoryContext?: string;
  hasUnreadProactive?: boolean;
  onOpenProactiveChat?: () => void;
}

interface MiniTurn {
  role: "user" | "kith";
  text: string;
}

export function AlwaysOnWidget({
  identity,
  ageTier,
  userName,
  offlineMode,
  onOpenFullChat,
  memoryContext,
  hasUnreadProactive = false,
  onOpenProactiveChat,
}: AlwaysOnWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const [gesture, setGesture] = useState<GestureId>("warm_nod");
  const [quickInput, setQuickInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const callName = identity.activeNickname || "friend";
  const [history, setHistory] = useState<MiniTurn[]>([]);
  const [quickReply, setQuickReply] = useState(
    `Hey ${callName}, ${identity.primaryName} is right here if you need a quick smile or help.`
  );

  function handleQuickSmile() {
    setError(null);
    setGesture("wink");
    setQuickReply(
      `Wink from ${identity.primaryName}: keep your chin up, ${callName}. You've got more capability in your corner than you realize.`
    );
  }

  async function handleQuickAsk() {
    const trimmed = quickInput.trim();
    if (!trimmed || busy) return;
    setError(null);

    if (offlineMode || (typeof navigator !== "undefined" && !navigator.onLine)) {
      const local = getOfflineCompanionReply(trimmed, identity);
      setGesture(local.gesture);
      setQuickReply(local.reply);
      setHistory((prev) =>
        [...prev, { role: "user" as const, text: trimmed }, { role: "kith" as const, text: local.reply }].slice(-8)
      );
      setQuickInput("");
      return;
    }

    const nextHistory: MiniTurn[] = [
      ...history,
      { role: "user" as const, text: trimmed },
    ].slice(-8);
    setQuickInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/kith/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: nextHistory,
          identity,
          ageTier,
          userName,
          memoryContext: memoryContext || undefined,
          mode: "mini",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to reach companion.");
      }

      const replyText = String(data.reply || "").trim();
      const nextGesture = (data.gesture as GestureId) || "warm_nod";
      setGesture(nextGesture);
      setQuickReply(replyText);
      setHistory([...nextHistory, { role: "kith" as const, text: replyText }].slice(-8));
    } catch {
      const fallback = getOfflineCompanionReply(trimmed, identity);
      setGesture(fallback.gesture);
      setQuickReply(`${fallback.reply} (Offline fallback)`);
      setHistory([...nextHistory, { role: "kith" as const, text: fallback.reply }].slice(-8));
    } finally {
      setBusy(false);
    }
  }

  if (!expanded) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={
            hasUnreadProactive
              ? `Open Always-On Companion ${identity.primaryName} (new check-in available)`
              : `Open Always-On Companion ${identity.primaryName}`
          }
          className="relative flex items-center gap-2.5 pl-2 pr-3.5 py-2 bg-surface border border-edge rounded-full shadow-md hover:border-edge-strong transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-[#090D16] border border-[#1E293B] shrink-0">
            <LiveRigSvg identity={identity} gesture={gesture} compact />
          </div>
          <span className="text-xs font-semibold text-ink whitespace-nowrap">
            {identity.activeNickname || identity.primaryName}
          </span>
          {hasUnreadProactive && (
            <span
              aria-hidden="true"
              className="w-2.5 h-2.5 rounded-full bg-accent ring-2 ring-surface animate-pulse shrink-0"
            />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[calc(100vw-2rem)] bg-surface border border-edge rounded-2xl shadow-lg overflow-hidden">
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-edge bg-surface-alt">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full overflow-hidden bg-[#090D16] border border-[#1E293B] shrink-0">
            <LiveRigSvg identity={identity} gesture={gesture} compact />
          </div>
          <div className="text-xs font-semibold text-ink truncate">
            {identity.primaryName} {offlineMode ? "(Offline Mode)" : ""}
          </div>
        </div>
        <button
          type="button"
          aria-label="Minimize companion widget"
          onClick={() => setExpanded(false)}
          className="p-1 text-ink-muted hover:text-ink cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3.5 space-y-3">
        <p className="text-xs text-ink-secondary leading-relaxed bg-surface-alt border border-edge rounded-xl p-3">
          {busy ? `${identity.primaryName} is replying...` : quickReply}
        </p>

        {error && (
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-[11px] text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleQuickAsk();
              }
            }}
            placeholder={
              offlineMode
                ? "Quick offline message..."
                : `Ask ${identity.primaryName} anything...`
            }
            className="flex-1 min-w-0 px-2.5 py-1.5 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <button
            type="button"
            disabled={busy || !quickInput.trim()}
            onClick={() => void handleQuickAsk()}
            aria-label="Send quick message"
            className="p-1.5 text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleQuickSmile}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover cursor-pointer"
          >
            <Smile className="w-3.5 h-3.5" />
            Quick Smile
          </button>
          <button
            type="button"
            onClick={() => {
              setExpanded(false);
              if (hasUnreadProactive && onOpenProactiveChat) {
                onOpenProactiveChat();
              } else {
                onOpenFullChat();
              }
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary hover:text-ink cursor-pointer"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {hasUnreadProactive ? "Read Check-In" : "Open Full Chat"}
          </button>
        </div>
      </div>
    </div>
  );
}
