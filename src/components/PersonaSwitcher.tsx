import { useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  ARCHETYPES,
  resolvePersonaVoiceSpec,
  type CompanionIdentity,
  type GestureId,
} from "../types/kith";

interface PersonaSwitcherProps {
  identity: CompanionIdentity;
  onSelectPersona: (nextNickname: string, gesture: GestureId) => void;
}

export function PersonaSwitcher({
  identity,
  onSelectPersona,
}: PersonaSwitcherProps) {
  const arch = ARCHETYPES[identity.archetype];
  const tags =
    identity.nicknames.length > 0
      ? identity.nicknames
      : [identity.primaryName || "Julian"];
  const activeTag = identity.activeNickname || tags[0];
  const activeSpec = resolvePersonaVoiceSpec(activeTag, identity.primaryName);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function activateTag(tag: string) {
    const spec = resolvePersonaVoiceSpec(tag, identity.primaryName);
    onSelectPersona(tag, spec.recommendedGesture);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLButtonElement>, idx: number) {
    let nextIdx = -1;
    if (e.key === "ArrowRight") {
      nextIdx = (idx + 1) % tags.length;
    } else if (e.key === "ArrowLeft") {
      nextIdx = (idx - 1 + tags.length) % tags.length;
    } else if (e.key === "Home") {
      nextIdx = 0;
    } else if (e.key === "End") {
      nextIdx = tags.length - 1;
    }
    if (nextIdx >= 0) {
      e.preventDefault();
      tabRefs.current[nextIdx]?.focus();
      activateTag(tags[nextIdx]);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-surface border border-edge rounded-xl">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider whitespace-nowrap">
          Persona
        </span>
        <div
          role="tablist"
          aria-label="Switch companion persona voice"
          className="flex items-center gap-1 overflow-x-auto"
        >
          {tags.map((tag, idx) => {
            const spec = resolvePersonaVoiceSpec(tag, identity.primaryName);
            const selected = tag === activeTag;
            return (
              <button
                key={tag}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={() => activateTag(tag)}
                onKeyDown={(e) => handleKeyDown(e, idx)}
                style={
                  selected
                    ? { borderBottomColor: arch.accentHex }
                    : undefined
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selected
                    ? "text-ink bg-surface-alt"
                    : "text-ink-muted border-transparent hover:text-ink hover:bg-surface-alt/60"
                }`}
              >
                <span className={`w-2 h-2 rounded-full shrink-0 ${spec.dotClass}`} />
                <span>{tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      <span className="text-[11px] text-ink-muted truncate">
        <span className="font-medium text-ink">{activeSpec.label}:</span>{" "}
        {activeSpec.role}
      </span>
    </div>
  );
}
