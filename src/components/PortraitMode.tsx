import { useState, useEffect } from "react";
import { Sparkles, Download, Share2, RefreshCw, Lock } from "lucide-react";
import type { CompanionIdentity } from "../types/kith";
import {
  PORTRAIT_STYLES,
  type PortraitStyle,
  getCachedPortrait,
  cachePortrait,
  checkPortraitRateLimit,
  incrementPortraitRateLimit,
} from "../lib/portraitStore";
import { buildShareUrl } from "../lib/shareAvatar";

interface PortraitModeProps {
  identity: CompanionIdentity;
  onOpenShareModal?: () => void;
  onLogActivity?: (summary: string) => void;
}

export function PortraitMode({ identity, onOpenShareModal, onLogActivity }: PortraitModeProps) {
  const [style, setStyle] = useState<PortraitStyle>("painterly");
  const [state, setState] = useState<"idle" | "generating" | "done" | "error">("idle");
  const [portraitUrl, setPortraitUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitStatus, setRateLimitStatus] = useState(() => checkPortraitRateLimit());

  useEffect(() => {
    const cached = getCachedPortrait(identity, style);
    if (cached) {
      setPortraitUrl(cached);
      setState("done");
    } else {
      setPortraitUrl(null);
      setState("idle");
    }
  }, [identity, style]);

  async function handleGenerate() {
    const limit = checkPortraitRateLimit();
    setRateLimitStatus(limit);
    if (!limit.allowed) {
      setErrorMessage("Daily free portrait limit reached (5 / 5). Try again tomorrow!");
      setState("error");
      return;
    }

    setState("generating");
    setErrorMessage(null);

    const payload = {
      archetype: identity.archetype,
      decade: identity.decadeStage,
      persona: identity.activeNickname || identity.primaryName,
      hairColor: identity.hairLength > 50 ? "long dark" : "short neat",
      eyeColor: "vibrant",
      style,
      identity,
    };

    try {
      let res = await fetch("/api/portrait", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok && res.status === 404) {
        res = await fetch("/api/kith/portrait", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to generate portrait.");
      }
      const url = data.imageUrl;
      if (!url) throw new Error("No image URL returned.");

      cachePortrait(identity, style, url);
      incrementPortraitRateLimit();
      setRateLimitStatus(checkPortraitRateLimit());
      setPortraitUrl(url);
      setState("done");
      onLogActivity?.(`Generated AI portrait (${style}) for ${identity.primaryName}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate AI portrait.");
      setState("error");
    }
  }

  function handleDownload() {
    if (!portraitUrl) return;
    const a = document.createElement("a");
    a.href = portraitUrl;
    a.download = `${identity.primaryName || "companion"}_portrait_${style}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleShare() {
    if (onOpenShareModal) {
      onOpenShareModal();
    } else {
      const shareUrl = buildShareUrl(identity);
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(shareUrl).catch(() => {});
      }
    }
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-ink flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-ink" />
            AI Portrait Mode
          </h2>
          <p className="text-xs text-ink-muted">
            Render {identity.primaryName}&apos;s current configuration into a high-end AI portrait on demand.
          </p>
        </div>
        <div className="text-[11px] font-mono-tabular text-ink-muted">
          Free daily: {rateLimitStatus.remaining}/{FREE_PORTRAIT_DAILY_LIMIT} left
        </div>
      </div>

      {/* Style Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PORTRAIT_STYLES.map((s) => {
          const active = style === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStyle(s.id)}
              className={`p-2.5 rounded-xl border text-left transition-colors cursor-pointer ${
                active
                  ? "bg-accent text-accent-fg border-accent"
                  : "bg-surface-alt text-ink border-edge hover:border-edge-strong"
              }`}
            >
              <div className="text-xs font-semibold">{s.label}</div>
              <div className="text-[10px] opacity-80 truncate mt-0.5">{s.tagline}</div>
            </button>
          );
        })}
      </div>

      {state === "idle" && (
        <div className="p-4 rounded-xl bg-surface-alt border border-edge space-y-3 text-center">
          <p className="text-xs text-ink-secondary">
            Ready to paint {identity.primaryName} in <span className="font-semibold text-ink">{style}</span> style. Takes ~8–12 seconds.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!rateLimitStatus.allowed}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Generate AI Portrait
          </button>
        </div>
      )}

      {state === "generating" && (
        <div className="text-center py-10 px-4 rounded-xl bg-surface-alt border border-edge space-y-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-ink">
            Painting {identity.primaryName}&apos;s portrait ({style})...
          </p>
          <p className="text-[11px] text-ink-muted">
            Rendering prompt with archetype layers, decade features, and lighting.
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-3 text-center">
          <p className="text-xs text-red-800 dark:text-red-200 font-medium">
            {errorMessage || "Generation failed."}
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      )}

      {state === "done" && portraitUrl && (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border border-edge bg-black/40 aspect-[3/4] max-w-sm mx-auto shadow-lg">
            <img
              src={portraitUrl}
              alt={`${identity.primaryName} AI portrait`}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-3 left-3 right-3 py-1.5 px-3 rounded-lg bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center justify-between">
              <span>{identity.primaryName} · {style}</span>
              <span className="opacity-75">AI Masterpiece</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-accent-fg bg-accent rounded-xl hover:bg-accent-hover transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-ink bg-surface-alt border border-edge rounded-xl hover:border-edge-strong transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              Share Link
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-ink bg-surface-alt border border-edge rounded-xl hover:border-edge-strong transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FREE_PORTRAIT_DAILY_LIMIT = 5;
