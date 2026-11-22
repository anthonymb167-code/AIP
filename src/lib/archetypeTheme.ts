import { useEffect, useMemo } from "react";
import type { ArchetypeId } from "../types/kith";

export type ArchetypeEyewearStyle =
  | "angular_noir"
  | "round_brass"
  | "aero_visor"
  | "filigree_amber"
  | "tortoise_retro";

export interface ArchetypePalette {
  id: ArchetypeId;
  name: string;
  eyewearStyle: ArchetypeEyewearStyle;
  skin: [string, string, string];
  skinShadow: string;
  eyeShadow: string;
  iris: [string, string, string];
  hair: [string, string, string];
  hairHighlight: string;
  coat: [string, string, string];
  shirt: string;
  trouser: [string, string];
  rim: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  accentText: string;
  accentBorder: string;
  frame: [string, string, string];
  lip: [string, string];
}

export const ARCHETYPE_PALETTES: Record<ArchetypeId, ArchetypePalette> = {
  goth_academia: {
    id: "goth_academia",
    name: "Goth / Dark Academia",
    eyewearStyle: "angular_noir",
    skin: ["#F6DCD0", "#E8BDA7", "#C8927B"],
    skinShadow: "#B67D67",
    eyeShadow: "#2A1F3D",
    iris: ["#A78BFA", "#4F46E5", "#1E1B4B"],
    hair: ["#3B2E2A", "#261E1B", "#140F0E"],
    hairHighlight: "#5C4742",
    coat: ["#2D3442", "#1F242D", "#10131A"],
    shirt: "#111318",
    trouser: ["#1E2330", "#0C0F17"],
    rim: "#818CF8",
    accent: "#4F46E5",
    accentSoft: "rgba(79, 70, 229, 0.16)",
    accentGlow: "rgba(129, 140, 248, 0.32)",
    accentText: "#A5B4FC",
    accentBorder: "rgba(129, 140, 248, 0.35)",
    frame: ["#CBD5E1", "#64748B", "#334155"],
    lip: ["#B4695E", "#7C3F38"],
  },
  classic_scholar: {
    id: "classic_scholar",
    name: "Classic Scholar",
    eyewearStyle: "round_brass",
    skin: ["#F8DEC9", "#ECC3A7", "#CE9B7A"],
    skinShadow: "#BA8363",
    eyeShadow: "#5C4233",
    iris: ["#D99B52", "#8B5A2B", "#3E2412"],
    hair: ["#5A4336", "#3B2B22", "#221813"],
    hairHighlight: "#7D5E4C",
    coat: ["#59644E", "#444D3B", "#262C21"],
    shirt: "#F4F1EA",
    trouser: ["#2D332B", "#181C17"],
    rim: "#F59E0B",
    accent: "#1E3A5F",
    accentSoft: "rgba(30, 58, 95, 0.16)",
    accentGlow: "rgba(217, 119, 6, 0.28)",
    accentText: "#93C5FD",
    accentBorder: "rgba(59, 130, 246, 0.35)",
    frame: ["#FCD34D", "#B45309", "#78350F"],
    lip: ["#C27564", "#8A4A3C"],
  },
  sporty_vanguard: {
    id: "sporty_vanguard",
    name: "Sporty Vanguard",
    eyewearStyle: "aero_visor",
    skin: ["#F7D7BE", "#E6B593", "#C78D6B"],
    skinShadow: "#B37757",
    eyeShadow: "#254059",
    iris: ["#67E8F9", "#0284C7", "#0C4A6E"],
    hair: ["#3E322B", "#241D18", "#130F0C"],
    hairHighlight: "#665246",
    coat: ["#3A5E82", "#2B4661", "#162638"],
    shirt: "#F8FAFC",
    trouser: ["#1E293B", "#0F172A"],
    rim: "#38BDF8",
    accent: "#0F4C81",
    accentSoft: "rgba(14, 165, 233, 0.16)",
    accentGlow: "rgba(56, 189, 248, 0.32)",
    accentText: "#7DD3FC",
    accentBorder: "rgba(56, 189, 248, 0.35)",
    frame: ["#E0F2FE", "#38BDF8", "#0369A1"],
    lip: ["#BA6B5B", "#854539"],
  },
  arcane_fantasy: {
    id: "arcane_fantasy",
    name: "Arcane Fantasy",
    eyewearStyle: "filigree_amber",
    skin: ["#F7DDD0", "#E9BEA8", "#C8957C"],
    skinShadow: "#B47E67",
    eyeShadow: "#1D3B32",
    iris: ["#6EE7B7", "#059669", "#064E3B"],
    hair: ["#553F30", "#38291E", "#1F1610"],
    hairHighlight: "#7D5E47",
    coat: ["#1F634E", "#144536", "#0A261D"],
    shirt: "#EFE9DC",
    trouser: ["#1A2E27", "#0D1915"],
    rim: "#34D399",
    accent: "#065F46",
    accentSoft: "rgba(16, 185, 129, 0.16)",
    accentGlow: "rgba(52, 211, 153, 0.3)",
    accentText: "#6EE7B7",
    accentBorder: "rgba(52, 211, 153, 0.35)",
    frame: ["#FDE68A", "#D97706", "#92400E"],
    lip: ["#B96D60", "#82453B"],
  },
  retro_analog: {
    id: "retro_analog",
    name: "Retro Analog",
    eyewearStyle: "tortoise_retro",
    skin: ["#F6D7BF", "#E5B492", "#C48D6B"],
    skinShadow: "#AF7655",
    eyeShadow: "#4A2E20",
    iris: ["#FDBA74", "#C2410C", "#431407"],
    hair: ["#382D28", "#201916", "#110D0B"],
    hairHighlight: "#5C4940",
    coat: ["#D98836", "#B46B24", "#6B3D12"],
    shirt: "#5C3A28",
    trouser: ["#3B2B22", "#1F1510"],
    rim: "#FBBF24",
    accent: "#9A3412",
    accentSoft: "rgba(217, 119, 6, 0.16)",
    accentGlow: "rgba(251, 191, 36, 0.3)",
    accentText: "#FCD34D",
    accentBorder: "rgba(245, 158, 11, 0.35)",
    frame: ["#FDBA74", "#9A3412", "#431407"],
    lip: ["#BC6F5A", "#864637"],
  },
};

export function getArchetypePalette(archetypeId: ArchetypeId): ArchetypePalette {
  return ARCHETYPE_PALETTES[archetypeId] || ARCHETYPE_PALETTES.classic_scholar;
}

export function buildArchetypeCssVarMap(palette: ArchetypePalette): Record<string, string> {
  return {
    "--aip-arch-accent": palette.accent,
    "--aip-arch-accent-soft": palette.accentSoft,
    "--aip-arch-accent-glow": palette.accentGlow,
    "--aip-arch-accent-text": palette.accentText,
    "--aip-arch-accent-border": palette.accentBorder,
    "--aip-arch-rim": palette.rim,
    "--aip-arch-coat": palette.coat[1],
    "--aip-arch-hair": palette.hair[1],
    "--aip-arch-iris": palette.iris[1],
  };
}

export function formatArchetypeCssBlock(archetypeId: ArchetypeId): string {
  const palette = getArchetypePalette(archetypeId);
  const vars = buildArchetypeCssVarMap(palette);
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `/* ${palette.name} */\n:root {\n${lines.join("\n")}\n}`;
}

export function useArchetypePalette(archetypeId: ArchetypeId) {
  return useMemo(() => {
    const palette = getArchetypePalette(archetypeId);
    return {
      palette,
      cssVars: buildArchetypeCssVarMap(palette),
      cssBlock: formatArchetypeCssBlock(archetypeId),
    };
  }, [archetypeId]);
}

export function useArchetypeCSSVars(archetypeId: ArchetypeId) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const palette = getArchetypePalette(archetypeId);
    const vars = buildArchetypeCssVarMap(palette);
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [archetypeId]);
}
