import type { CompanionIdentity } from "../types/kith";

export type PortraitStyle = "painterly" | "photorealistic" | "cinematic" | "anime";

export interface PortraitStyleSpec {
  id: PortraitStyle;
  label: string;
  tagline: string;
}

export const PORTRAIT_STYLES: PortraitStyleSpec[] = [
  { id: "painterly", label: "Painterly", tagline: "Oil brush strokes & fine art canvas" },
  { id: "photorealistic", label: "Photorealistic", tagline: "Studio photography with crisp 8k detail" },
  { id: "cinematic", label: "Cinematic", tagline: "Film still with dramatic anamorphic lighting" },
  { id: "anime", label: "Anime", tagline: "Japanese character design & cel shading" },
];

export function hashConfig(identity: CompanionIdentity, style: PortraitStyle): string {
  const payload = {
    arc: identity.archetype,
    dec: identity.decadeStage,
    gen: identity.gender,
    name: identity.primaryName,
    nick: identity.activeNickname,
    coat: identity.coatLayering,
    hair: identity.hairLength,
    acc: identity.accessoryDetail,
    warm: identity.warmthHumor,
    depth: identity.scholarlyDepth,
    style,
  };
  let hash = 0;
  const str = JSON.stringify(payload);
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `pt_${Math.abs(hash).toString(36)}`;
}

export function getCachedPortrait(identity: CompanionIdentity, style: PortraitStyle): string | null {
  if (typeof window === "undefined") return null;
  try {
    const key = hashConfig(identity, style);
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function cachePortrait(identity: CompanionIdentity, style: PortraitStyle, url: string): void {
  if (typeof window === "undefined") return;
  try {
    const key = hashConfig(identity, style);
    window.localStorage.setItem(key, url);
  } catch {
    // ignore
  }
}

export const PORTRAIT_LIMIT_KEY = "aip_portrait_daily_count";
export const PORTRAIT_LIMIT_DATE_KEY = "aip_portrait_daily_date";
export const FREE_PORTRAIT_DAILY_LIMIT = 5;

export function checkPortraitRateLimit(): { count: number; allowed: boolean; remaining: number } {
  if (typeof window === "undefined") return { count: 0, allowed: true, remaining: 5 };
  try {
    const today = new Date().toDateString();
    const savedDate = window.localStorage.getItem(PORTRAIT_LIMIT_DATE_KEY);
    const countStr = window.localStorage.getItem(PORTRAIT_LIMIT_KEY);
    let count = countStr ? parseInt(countStr, 10) || 0 : 0;

    if (savedDate !== today) {
      window.localStorage.setItem(PORTRAIT_LIMIT_DATE_KEY, today);
      window.localStorage.setItem(PORTRAIT_LIMIT_KEY, "0");
      count = 0;
    }

    const remaining = Math.max(0, FREE_PORTRAIT_DAILY_LIMIT - count);
    return {
      count,
      allowed: count < FREE_PORTRAIT_DAILY_LIMIT,
      remaining,
    };
  } catch {
    return { count: 0, allowed: true, remaining: 5 };
  }
}

export function incrementPortraitRateLimit(): void {
  if (typeof window === "undefined") return;
  try {
    const status = checkPortraitRateLimit();
    const nextCount = status.count + 1;
    window.localStorage.setItem(PORTRAIT_LIMIT_KEY, String(nextCount));
  } catch {
    // ignore
  }
}
