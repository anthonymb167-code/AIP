import { useState } from "react";
import { Check, Copy, Code2 } from "lucide-react";
import type { ArchetypeId } from "../types/kith";
import { useArchetypePalette } from "../lib/archetypeTheme";

interface SwatchGroup {
  label: string;
  colors: { name: string; hex: string }[];
}

export function PaletteSwatchInline({ archetypeId }: { archetypeId: ArchetypeId }) {
  const { palette } = useArchetypePalette(archetypeId);
  const chips = [
    palette.coat[1],
    palette.accent,
    palette.iris[1],
    palette.hair[1],
    palette.rim,
  ];
  return (
    <span className="inline-flex items-center gap-1 mt-1" aria-hidden="true">
      {chips.map((hex, i) => (
        <span
          key={`${archetypeId}-chip-${i}`}
          className="w-2.5 h-2.5 rounded-sm border border-black/20 dark:border-white/20 shrink-0"
          style={{ backgroundColor: hex }}
        />
      ))}
    </span>
  );
}

export function PaletteSwatch({ archetypeId }: { archetypeId: ArchetypeId }) {
  const { palette, cssBlock } = useArchetypePalette(archetypeId);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);

  function copyText(text: string, tag: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedValue(tag);
    window.setTimeout(() => {
      setCopiedValue((prev) => (prev === tag ? null : prev));
    }, 1600);
  }

  const groups: SwatchGroup[] = [
    {
      label: "Skin & Shadow",
      colors: [
        { name: "Highlight", hex: palette.skin[0] },
        { name: "Midtone", hex: palette.skin[1] },
        { name: "Edge", hex: palette.skin[2] },
        { name: "Shadow", hex: palette.skinShadow },
      ],
    },
    {
      label: "Iris & Lip",
      colors: [
        { name: "Iris Glow", hex: palette.iris[0] },
        { name: "Iris Core", hex: palette.iris[1] },
        { name: "Iris Deep", hex: palette.iris[2] },
        { name: "Lip Tint", hex: palette.lip[0] },
      ],
    },
    {
      label: "Hair",
      colors: [
        { name: "Sheen", hex: palette.hairHighlight },
        { name: "Highlight", hex: palette.hair[0] },
        { name: "Base", hex: palette.hair[1] },
        { name: "Deep", hex: palette.hair[2] },
      ],
    },
    {
      label: "Attire & Rim",
      colors: [
        { name: "Coat High", hex: palette.coat[0] },
        { name: "Coat Mid", hex: palette.coat[1] },
        { name: "Shirt", hex: palette.shirt },
        { name: "Rim Light", hex: palette.rim },
      ],
    },
    {
      label: "Eyewear Frame",
      colors: [
        { name: "Frame High", hex: palette.frame[0] },
        { name: "Frame Mid", hex: palette.frame[1] },
        { name: "Frame Deep", hex: palette.frame[2] },
        { name: "Accent", hex: palette.accent },
      ],
    },
  ];

  function handleCopyAll() {
    const summary = groups
      .map((g) => `${g.label}: ${g.colors.map((c) => `${c.name} ${c.hex}`).join(", ")}`)
      .join("\n");
    copyText(`${palette.name} Palette\n${summary}`, "all");
  }

  return (
    <div className="pt-3 mt-1 border-t border-edge space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-ink">
            {palette.name} Lighting &amp; Material Palette
          </div>
          <p className="text-[11px] text-ink-muted">
            Click any swatch to copy its hex value or export CSS tokens.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-edge bg-surface-alt text-ink-secondary hover:border-edge-strong hover:text-ink transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedValue === "all" ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            {copiedValue === "all" ? "Copied" : "Copy Palette"}
          </button>
          <button
            type="button"
            onClick={() => copyText(cssBlock, "css")}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-edge bg-surface-alt text-ink-secondary hover:border-edge-strong hover:text-ink transition-colors whitespace-nowrap cursor-pointer"
          >
            {copiedValue === "css" ? (
              <Check className="w-3 h-3 text-emerald-500" />
            ) : (
              <Code2 className="w-3 h-3" />
            )}
            {copiedValue === "css" ? "CSS Copied" : "Export CSS"}
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {groups.map((group) => (
          <div key={group.label} className="space-y-1">
            <div className="text-[11px] font-medium text-ink-muted">
              {group.label}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {group.colors.map((color) => {
                const tokenKey = `${group.label}-${color.name}`;
                const isCopied = copiedValue === tokenKey;
                return (
                  <button
                    key={tokenKey}
                    type="button"
                    onClick={() => copyText(color.hex, tokenKey)}
                    title={`Copy ${color.hex}`}
                    className="flex items-center gap-2 p-1.5 rounded-lg border border-edge bg-surface-alt hover:border-edge-strong text-left transition-colors cursor-pointer"
                  >
                    <span
                      className="w-5 h-5 rounded border border-black/15 dark:border-white/20 shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-medium text-ink truncate">
                        {isCopied ? "Copied" : color.name}
                      </span>
                      <span className="block font-mono-tabular text-[10px] text-ink-muted truncate">
                        {color.hex}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
