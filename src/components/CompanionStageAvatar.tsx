import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { motion } from "motion/react";
import { Check, Download, Share2 } from "lucide-react";
import {
  ARCHETYPES,
  AVATAR_FRAMING_OPTIONS,
  DECADE_STAGES,
  DEFAULT_BACKGROUND_SPEC,
  DEFAULT_RIG_MOTION_CONFIG,
  FACIAL_RIG_STATES,
  GESTURE_LABELS,
  type AvatarFraming,
  type CompanionIdentity,
  type GestureId,
  type RigMotionConfig,
  type VisemeId,
} from "../types/kith";
import { CompanionAvatar3D } from "./CompanionAvatar3D";
import { buildShareUrl } from "../lib/shareAvatar";
import { APP_COPY } from "../lib/copy";
import { getArchetypePalette } from "../lib/archetypeTheme";

export type StageViewMode = "3d" | "rig" | "portrait";

interface CompanionStageAvatarProps {
  identity: CompanionIdentity;
  gesture: GestureId;
  speechText: string;
  viewMode: StageViewMode;
  framing?: AvatarFraming;
  onChangeFraming?: (framing: AvatarFraming) => void;
  isSpeaking?: boolean;
  speechEnergy?: number;
  speechViseme?: VisemeId;
  rigConfig?: RigMotionConfig;
  onToggleViewMode?: (mode: StageViewMode) => void;
  onOpenShareModal?: () => void;
}

export function LiveRigSvg({
  identity,
  gesture,
  framing = "half_body",
  isSpeaking = false,
  speechEnergy = 0,
  speechViseme = "closed",
  rigConfig = DEFAULT_RIG_MOTION_CONFIG,
  compact = false,
  svgRef,
}: {
  identity: CompanionIdentity;
  gesture: GestureId;
  framing?: AvatarFraming;
  isSpeaking?: boolean;
  speechEnergy?: number;
  speechViseme?: VisemeId;
  rigConfig?: RigMotionConfig;
  compact?: boolean;
  svgRef?: RefObject<SVGSVGElement | null>;
}) {
  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9_-]/g, "");
  const [isBlinking, setIsBlinking] = useState(false);

  // Organic spontaneous blinking for the 2D Live Rig
  useEffect(() => {
    if (!rigConfig.autoBlink) {
      setIsBlinking(false);
      return;
    }
    let blinkTimeout = 0;
    let openTimeout = 0;
    let cancelled = false;

    const scheduleNextBlink = () => {
      const delayMs = 2400 + Math.random() * 2600;
      blinkTimeout = window.setTimeout(() => {
        if (cancelled) return;
        setIsBlinking(true);
        openTimeout = window.setTimeout(() => {
          if (cancelled) return;
          setIsBlinking(false);
          scheduleNextBlink();
        }, 145);
      }, delayMs);
    };

    scheduleNextBlink();
    return () => {
      cancelled = true;
      window.clearTimeout(blinkTimeout);
      window.clearTimeout(openTimeout);
    };
  }, [rigConfig.autoBlink]);

  const arch = ARCHETYPES[identity.archetype];
  const palette = getArchetypePalette(identity.archetype);
  const gender = identity.gender || "masculine";
  const rigSpec = FACIAL_RIG_STATES[gesture] || FACIAL_RIG_STATES.warm_nod;
  const decade = identity.decadeStage; // 0..3
  const isMaturing = identity.maturityMode !== "timeless";
  const effectiveDecade = isMaturing ? decade : 0;
  const hasGlasses =
    identity.archetype === "classic_scholar" ||
    identity.accessoryDetail >= 55 ||
    effectiveDecade >= 2;
  const silverOpacity =
    effectiveDecade === 0 ? 0 : effectiveDecade === 1 ? 0.25 : effectiveDecade === 2 ? 0.55 : 0.85;
  const hairTopHeight = 22 + Math.round((identity.hairLength / 100) * 16);
  const lapelWidth = 14 + Math.round((identity.coatLayering / 100) * 16);
  const coatSkirtLen = 288 + Math.round((identity.coatLayering / 100) * 58);
  const showSideLocks =
    gender === "feminine" ||
    (gender === "nonbinary" && identity.hairLength >= 35) ||
    identity.hairLength >= 72;
  const sideLockBottomY =
    gender === "feminine"
      ? 190 + Math.round((identity.hairLength / 100) * 44)
      : 168 + Math.round((identity.hairLength / 100) * 32);
  const browStrokeWidth = gender === "feminine" ? 2.2 : gender === "nonbinary" ? 2.7 : 3.2;

  const headTilt = -rigSpec.headTiltDeg * 0.6;
  const headYOffset = gesture === "laugh" ? -4 : gesture === "warm_nod" ? 3 : 0;

  const activeSpeaking = isSpeaking && rigConfig.lipSync;

  const activeFraming: AvatarFraming = framing || identity.cameraFraming || "half_body";
  const svgViewBox = compact
    ? "30 25 220 220"
    : activeFraming === "headshot"
    ? "45 36 190 185"
    : activeFraming === "full_body"
    ? "-24 -8 328 478"
    : "0 0 280 300";

  const facePathD =
    gender === "feminine"
      ? "M92 112 C92 74, 188 74, 188 112 L183 148 C178 178, 158 194, 140 194 C122 194, 102 178, 97 148 Z"
      : gender === "nonbinary"
      ? "M91 112 C91 74, 189 74, 189 112 L186 149 C182 179, 160 195, 140 195 C120 195, 98 179, 94 149 Z"
      : "M90 112 C90 74, 190 74, 190 112 L188 150 C186 180, 162 196, 140 196 C118 196, 94 180, 92 150 Z";

  // Namespaced SVG def IDs so compact & stage rigs never collide
  const ids = {
    skinGrad: `stageSkin-${uid}`,
    neckGrad: `neckGrad-${uid}`,
    irisGrad: `irisGrad-${uid}`,
    hairGrad: `hairGrad-${uid}`,
    coatGrad: `coatGrad-${uid}`,
    trouserGrad: `trouserGrad-${uid}`,
    frameGrad: `frameGrad-${uid}`,
    lipGrad: `lipGrad-${uid}`,
    rimGrad: `rimGrad-${uid}`,
    backdropGrad: `rigBackdropGrad-${uid}`,
    studioAura: `studioAura-${uid}`,
    softBlur: `softBlur-${uid}`,
    faceClip: `faceClip-${uid}`,
  };

  const renderMouth = () => {
    const lipStroke = `url(#${ids.lipGrad})`;
    if (activeSpeaking && speechViseme !== "closed" && speechViseme !== "mm") {
      const openAmp = Math.max(0.35, speechEnergy);
      if (speechViseme === "oh") {
        return (
          <g>
            <ellipse
              cx="140"
              cy="166"
              rx={6.5}
              ry={4 + openAmp * 5.5}
              fill="#3B1418"
              stroke={lipStroke}
              strokeWidth="2.5"
            />
            <path
              d={`M136 ${170 + openAmp * 4.5} Q140 ${172 + openAmp * 5.2} 144 ${170 + openAmp * 4.5}`}
              stroke={palette.skin[0]}
              strokeWidth="0.9"
              strokeOpacity="0.45"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        );
      }
      if (speechViseme === "ee") {
        return (
          <g>
            <path
              d={`M122 164 Q140 ${169 + openAmp * 6} 158 164 Q140 ${160} 122 164 Z`}
              fill="#F8FAFC"
              stroke={lipStroke}
              strokeWidth="2.3"
              strokeLinejoin="round"
            />
            <path
              d={`M131 ${167 + openAmp * 3.8} Q140 ${169 + openAmp * 4.6} 149 ${167 + openAmp * 3.8}`}
              stroke="#FFFFFF"
              strokeWidth="0.9"
              strokeOpacity="0.55"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        );
      }
      return (
        <g>
          <path
            d={`M123 163 Q140 ${172 + openAmp * 11} 157 163 Q140 161 123 163 Z`}
            fill="#3B1418"
            stroke={lipStroke}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M128 163.5 Q140 165.5 152 163.5"
            stroke="#F8FAFC"
            strokeWidth="1.5"
            strokeOpacity="0.72"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    }

    if (activeSpeaking && speechViseme === "mm") {
      return (
        <path
          d="M126 165 Q140 166.5 154 165"
          stroke={lipStroke}
          strokeWidth="3.0"
          fill="none"
          strokeLinecap="round"
        />
      );
    }

    if (gesture === "laugh") {
      return (
        <g>
          <path
            d="M120 162 Q140 182 160 162 Q140 160 120 162 Z"
            fill="#F8FAFC"
            stroke={lipStroke}
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M129 171 Q140 175 151 171"
            stroke={palette.lip[0]}
            strokeWidth="1.1"
            strokeOpacity="0.55"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    }
    if (gesture === "smirk") {
      return (
        <g>
          <path
            d="M126 167 Q144 170 158 159"
            stroke={lipStroke}
            strokeWidth="2.9"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M134 169.5 Q142 170.5 149 167"
            stroke={palette.skin[0]}
            strokeWidth="0.9"
            strokeOpacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    }
    if (gesture === "concerned_tilt") {
      return (
        <path
          d="M128 168 Q140 164 152 167"
          stroke={lipStroke}
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    if (gesture === "curious_brow") {
      return (
        <path
          d="M127 165 Q140 169 153 164"
          stroke={lipStroke}
          strokeWidth="2.7"
          fill="none"
          strokeLinecap="round"
        />
      );
    }
    if (gesture === "gentle_smile") {
      return (
        <g>
          <path
            d="M121 162 Q140 177 159 162"
            stroke={lipStroke}
            strokeWidth="2.9"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M133 171 Q140 173.5 147 171"
            stroke={palette.skin[0]}
            strokeWidth="0.9"
            strokeOpacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      );
    }
    return (
      <g>
        <path
          d="M123 163 Q140 175 157 163"
          stroke={lipStroke}
          strokeWidth="2.8"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M133 170 Q140 172 147 170"
          stroke={palette.skin[0]}
          strokeWidth="0.85"
          strokeOpacity="0.38"
          fill="none"
          strokeLinecap="round"
        />
      </g>
    );
  };

  const renderEyewear = () => {
    if (!hasGlasses) return null;
    const rimStroke = `url(#${ids.frameGrad})`;
    if (palette.eyewearStyle === "aero_visor") {
      return (
        <g>
          <path
            d="M96 122 L134 123 L130 137 Q114 140 99 134 Z"
            fill={palette.rim}
            fillOpacity="0.14"
            stroke={rimStroke}
            strokeWidth="2.0"
            strokeLinejoin="round"
          />
          <path
            d="M184 122 L146 123 L150 137 Q166 140 181 134 Z"
            fill={palette.rim}
            fillOpacity="0.14"
            stroke={rimStroke}
            strokeWidth="2.0"
            strokeLinejoin="round"
          />
          <path d="M134 125 Q140 123 146 125" stroke={rimStroke} strokeWidth="2.0" fill="none" />
          <line x1="90" y1="126" x2="97" y2="126" stroke={rimStroke} strokeWidth="2" />
          <line x1="183" y1="126" x2="190" y2="126" stroke={rimStroke} strokeWidth="2" />
          <line x1="103" y1="126" x2="112" y2="134" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.45" strokeLinecap="round" />
          <line x1="152" y1="126" x2="161" y2="134" stroke="#FFFFFF" strokeWidth="1.2" strokeOpacity="0.45" strokeLinecap="round" />
        </g>
      );
    }
    if (palette.eyewearStyle === "angular_noir" || palette.eyewearStyle === "tortoise_retro") {
      return (
        <g opacity="0.94">
          <rect
            x="101"
            y="119"
            width="30"
            height="20"
            rx={palette.eyewearStyle === "tortoise_retro" ? "6" : "4"}
            fill={palette.rim}
            fillOpacity="0.06"
            stroke={rimStroke}
            strokeWidth="2.0"
          />
          <rect
            x="149"
            y="119"
            width="30"
            height="20"
            rx={palette.eyewearStyle === "tortoise_retro" ? "6" : "4"}
            fill={palette.rim}
            fillOpacity="0.06"
            stroke={rimStroke}
            strokeWidth="2.0"
          />
          <path d="M131 127 Q140 124 149 127" stroke={rimStroke} strokeWidth="2.0" fill="none" />
          <line x1="91" y1="126" x2="101" y2="127" stroke={rimStroke} strokeWidth="1.8" />
          <line x1="179" y1="127" x2="189" y2="126" stroke={rimStroke} strokeWidth="1.8" />
          <path d="M105 123 L113 134" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.38" strokeLinecap="round" />
          <path d="M153 123 L161 134" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.38" strokeLinecap="round" />
        </g>
      );
    }
    // round_brass or filigree_amber
    return (
      <g opacity="0.94">
        <circle
          cx="116"
          cy="129"
          r="14"
          fill={palette.rim}
          fillOpacity="0.05"
          stroke={rimStroke}
          strokeWidth="1.9"
        />
        <circle
          cx="164"
          cy="129"
          r="14"
          fill={palette.rim}
          fillOpacity="0.05"
          stroke={rimStroke}
          strokeWidth="1.9"
        />
        <path d="M130 128 Q140 124.5 150 128" stroke={rimStroke} strokeWidth="1.9" fill="none" />
        <line x1="92" y1="127" x2="102" y2="128" stroke={rimStroke} strokeWidth="1.8" />
        <line x1="178" y1="128" x2="188" y2="127" stroke={rimStroke} strokeWidth="1.8" />
        <path d="M106 123 Q109 119 115 119" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.45" fill="none" strokeLinecap="round" />
        <path d="M154 123 Q157 119 163 119" stroke="#FFFFFF" strokeWidth="1.3" strokeOpacity="0.45" fill="none" strokeLinecap="round" />
      </g>
    );
  };

  const bgSpec = identity.backgroundSpec || DEFAULT_BACKGROUND_SPEC;

  return (
    <motion.svg
      ref={svgRef}
      viewBox={svgViewBox}
      className={compact ? "w-full h-full" : "w-full max-w-[310px] h-auto mx-auto rounded-2xl"}
      aria-label={`${identity.primaryName} live expression rig showing ${GESTURE_LABELS[gesture].label}`}
      animate={{
        rotate: activeFraming === "full_body" ? headTilt * 0.25 : headTilt,
        y: rigConfig.breathing && !compact ? [headYOffset, headYOffset - 2.2, headYOffset] : headYOffset,
      }}
      transition={{
        rotate: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
        y:
          rigConfig.breathing && !compact
            ? { duration: 3.8, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.22 },
      }}
    >
      <defs>
        <filter id={ids.softBlur} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <clipPath id={ids.faceClip}>
          <path d={facePathD} />
        </clipPath>
        <radialGradient id={ids.skinGrad} cx="44%" cy="36%" r="64%">
          <stop offset="0%" stopColor={palette.skin[0]} />
          <stop offset="62%" stopColor={palette.skin[1]} />
          <stop offset="100%" stopColor={palette.skin[2]} />
        </radialGradient>
        <linearGradient id={ids.neckGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.skinShadow} />
          <stop offset="55%" stopColor={palette.skin[1]} />
          <stop offset="100%" stopColor={palette.skin[2]} />
        </linearGradient>
        <radialGradient id={ids.irisGrad} cx="42%" cy="36%" r="60%">
          <stop offset="0%" stopColor={palette.iris[0]} />
          <stop offset="55%" stopColor={palette.iris[1]} />
          <stop offset="100%" stopColor={palette.iris[2]} />
        </radialGradient>
        <linearGradient id={ids.hairGrad} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0%" stopColor={palette.hair[0]} />
          <stop offset="52%" stopColor={palette.hair[1]} />
          <stop offset="100%" stopColor={palette.hair[2]} />
        </linearGradient>
        <linearGradient id={ids.coatGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.coat[0]} />
          <stop offset="55%" stopColor={palette.coat[1]} />
          <stop offset="100%" stopColor={palette.coat[2]} />
        </linearGradient>
        <linearGradient id={ids.trouserGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.trouser[0]} />
          <stop offset="100%" stopColor={palette.trouser[1]} />
        </linearGradient>
        <linearGradient id={ids.frameGrad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.frame[0]} />
          <stop offset="50%" stopColor={palette.frame[1]} />
          <stop offset="100%" stopColor={palette.frame[2]} />
        </linearGradient>
        <linearGradient id={ids.lipGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.lip[0]} />
          <stop offset="100%" stopColor={palette.lip[1]} />
        </linearGradient>
        <linearGradient id={ids.rimGrad} x1="0" y1="0.2" x2="1" y2="0.8">
          <stop offset="0%" stopColor={palette.rim} stopOpacity="0.65" />
          <stop offset="45%" stopColor={palette.rim} stopOpacity="0.12" />
          <stop offset="100%" stopColor={palette.rim} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ids.backdropGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bgSpec.skyTopHex} />
          <stop offset="100%" stopColor={bgSpec.skyBottomHex} />
        </linearGradient>
        <radialGradient id={ids.studioAura} cx="50%" cy="38%" r="58%">
          <stop offset="0%" stopColor={bgSpec.keyLightHex} stopOpacity="0.34" />
          <stop offset="65%" stopColor={palette.rim} stopOpacity="0.12" />
          <stop offset="100%" stopColor={arch.accentHex} stopOpacity="0" />
        </radialGradient>
      </defs>

      {!compact && (
        <g>
          <rect x="-32" y="-16" width="344" height="496" rx="18" fill={`url(#${ids.backdropGrad})`} />

          {bgSpec.propTheme === "library" && (
            <g fill="#1F1610" opacity="0.36">
              <rect x="6" y="20" width="48" height="420" rx="3" />
              <rect x="226" y="20" width="48" height="420" rx="3" />
              <line x1="10" y1="88" x2="50" y2="88" stroke="#D97706" strokeWidth="2" />
              <line x1="10" y1="158" x2="50" y2="158" stroke="#D97706" strokeWidth="2" />
              <line x1="230" y1="88" x2="270" y2="88" stroke="#D97706" strokeWidth="2" />
              <line x1="230" y1="158" x2="270" y2="158" stroke="#D97706" strokeWidth="2" />
            </g>
          )}

          {bgSpec.propTheme === "rainy_cafe" && (
            <g stroke="#CBD5E1" strokeOpacity="0.28" fill="none">
              <rect x="20" y="20" width="240" height="240" rx="6" strokeWidth="3" />
              <line x1="140" y1="20" x2="140" y2="260" strokeWidth="2" />
              <line x1="20" y1="130" x2="260" y2="130" strokeWidth="2" />
            </g>
          )}

          {bgSpec.propTheme === "observatory" && (
            <g stroke={bgSpec.rimLightHex} strokeOpacity="0.35" fill="none">
              <circle cx="140" cy="145" r="118" strokeWidth="1.8" strokeDasharray="5 6" />
              <circle cx="140" cy="145" r="90" strokeWidth="1.2" />
              <circle cx="48" cy="48" r="2" fill="#E0E7FF" />
              <circle cx="234" cy="56" r="2.2" fill="#E0E7FF" />
              <circle cx="88" cy="36" r="1.5" fill="#E0E7FF" />
            </g>
          )}

          {bgSpec.propTheme === "music_lounge" && (
            <g fill="#2A160B" opacity="0.32">
              <rect x="18" y="16" width="12" height="430" />
              <rect x="42" y="16" width="12" height="430" />
              <rect x="226" y="16" width="12" height="430" />
              <rect x="250" y="16" width="12" height="430" />
            </g>
          )}

          {bgSpec.propTheme === "outdoor_coast" && (
            <g>
              <rect x="-32" y="390" width="344" height="90" fill="#1E293B" opacity="0.3" />
              <circle cx="232" cy="58" r="18" fill={bgSpec.keyLightHex} opacity="0.55" />
            </g>
          )}

          {bgSpec.propTheme === "city" && (
            <g>
              <rect x="-32" y="388" width="344" height="92" fill="#0F172A" opacity="0.55" />
              <rect x="-10" y="95" width="46" height="305" fill="#111827" opacity="0.52" />
              <rect x="42" y="135" width="42" height="265" fill="#1E293B" opacity="0.52" />
              <rect x="196" y="120" width="44" height="280" fill="#1E293B" opacity="0.52" />
              <rect x="246" y="88" width="46" height="312" fill="#111827" opacity="0.52" />
              <rect x="0" y="128" width="24" height="4" fill="#FDE68A" opacity="0.7" />
              <rect x="0" y="156" width="24" height="4" fill="#FDE68A" opacity="0.6" />
              <rect x="256" y="122" width="24" height="4" fill="#7DD3FC" opacity="0.7" />
              <rect x="256" y="150" width="24" height="4" fill="#FDE68A" opacity="0.6" />
            </g>
          )}

          {bgSpec.propTheme === "river_boat" && (
            <g>
              <rect x="-32" y="365" width="344" height="115" fill="#0E7490" opacity="0.45" />
              <path
                d="M28 416 L252 416 L228 456 L52 456 Z"
                fill="#5C3A21"
                stroke="#3B2313"
                strokeWidth="3"
              />
              <circle cx="48" cy="368" r="7" fill="#FDE68A" opacity="0.88" />
            </g>
          )}

          {bgSpec.propTheme === "jungle" && (
            <g>
              <rect x="-32" y="395" width="344" height="85" fill="#14532D" opacity="0.48" />
              <path d="M-20 410 Q18 220 4 40" stroke="#4A3425" strokeWidth="14" fill="none" />
              <path d="M300 410 Q262 220 276 40" stroke="#4A3425" strokeWidth="14" fill="none" />
              <ellipse cx="14" cy="48" rx="48" ry="18" fill="#15803D" opacity="0.72" />
              <ellipse cx="266" cy="54" rx="48" ry="18" fill="#15803D" opacity="0.72" />
              <circle cx="54" cy="145" r="2.5" fill="#FEF08A" opacity="0.8" />
              <circle cx="228" cy="182" r="2.5" fill="#FEF08A" opacity="0.8" />
            </g>
          )}

          {bgSpec.propTheme === "pyramid" && (
            <g>
              <rect x="-32" y="385" width="344" height="95" fill="#C28D59" opacity="0.5" />
              <polygon points="140,86 24,388 256,388" fill="#B47B44" opacity="0.52" />
              <polygon points="140,86 140,388 256,388" fill="#8C5B2D" opacity="0.42" />
              <circle cx="242" cy="54" r="18" fill="#FEF3C7" opacity="0.72" />
            </g>
          )}

          {bgSpec.propTheme === "mars" && (
            <g>
              <rect x="-32" y="385" width="344" height="95" fill="#7C2D12" opacity="0.55" />
              <ellipse cx="140" cy="422" rx="135" ry="22" fill="#451A03" opacity="0.45" />
              <circle cx="42" cy="56" r="14" fill="#CBD5E1" opacity="0.65" />
              <circle cx="244" cy="70" r="6" fill="#FDE68A" opacity="0.78" />
            </g>
          )}

          <circle cx="140" cy="145" r="130" fill={`url(#${ids.studioAura})`} />
        </g>
      )}

      {showSideLocks && (
        <g fill={`url(#${ids.hairGrad})`} opacity="0.97">
          <path
            d={`M85 108 C72 136, 70 176, 82 ${sideLockBottomY} C96 ${sideLockBottomY - 6}, 102 184, 100 144 Z`}
          />
          <path
            d={`M195 108 C208 136, 210 176, 198 ${sideLockBottomY} C184 ${sideLockBottomY - 6}, 178 184, 180 144 Z`}
          />
          <path
            d={`M80 124 C77 146, 78 168, 84 ${sideLockBottomY - 12}`}
            stroke={palette.hairHighlight}
            strokeWidth="1.4"
            strokeOpacity="0.4"
            fill="none"
          />
        </g>
      )}

      {/* Lower Body: Tapered Trousers & Shoes (visible in full_body view) */}
      <g>
        <path
          d="M92 288 L134 288 L128 432 L98 432 Z"
          fill={`url(#${ids.trouserGrad})`}
        />
        <path
          d="M146 288 L188 288 L182 432 L152 432 Z"
          fill={`url(#${ids.trouserGrad})`}
        />
        <line x1="112" y1="296" x2="110" y2="424" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1.2" />
        <line x1="168" y1="296" x2="170" y2="424" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1.2" />
        {/* Leather Boots / Shoes */}
        <path
          d="M95 426 L130 426 L134 446 C134 452, 92 452, 88 446 Z"
          fill="#0F141D"
        />
        <path
          d="M150 426 L185 426 L192 446 C188 452, 146 452, 146 446 Z"
          fill="#0F141D"
        />
      </g>

      {/* Arms hanging along torso sides */}
      <g>
        <path
          d="M52 246 C42 284, 42 326, 48 352 L66 352 C68 318, 70 282, 74 252 Z"
          fill={`url(#${ids.coatGrad})`}
        />
        <ellipse cx="56" cy="360" rx="8" ry="11" fill={`url(#${ids.skinGrad})`} />

        <path
          d="M228 246 C238 284, 238 326, 232 352 L214 352 C212 318, 210 282, 206 252 Z"
          fill={`url(#${ids.coatGrad})`}
        />
        <ellipse cx="224" cy="360" rx="8" ry="11" fill={`url(#${ids.skinGrad})`} />
      </g>

      {/* Shoulders, Layered Coat & Tailcoat Hem */}
      <path
        d={
          gender === "feminine"
            ? `M54 ${coatSkirtLen} L58 232 C62 214, 94 210, 140 210 C186 210, 218 214, 222 232 L226 ${coatSkirtLen} Z`
            : `M44 ${coatSkirtLen} L48 228 C54 212, 88 208, 140 208 C192 208, 226 212, 232 228 L236 ${coatSkirtLen} Z`
        }
        fill={`url(#${ids.coatGrad})`}
      />
      {/* Subtle shoulder rim highlight */}
      <path
        d={
          gender === "feminine"
            ? "M59 231 C65 215, 92 211, 114 210"
            : "M49 227 C56 213, 86 209, 112 208"
        }
        stroke={palette.rim}
        strokeWidth="1.6"
        strokeOpacity="0.48"
        fill="none"
        strokeLinecap="round"
      />
      {/* Coat inner fold / shadow seam */}
      <line
        x1="140"
        y1="264"
        x2="140"
        y2={coatSkirtLen - 4}
        stroke="#000000"
        strokeOpacity="0.22"
        strokeWidth="1.5"
      />
      {/* Shirt */}
      <path
        d="M108 208 L140 264 L172 208 C158 202, 122 202, 108 208 Z"
        fill={palette.shirt}
      />
      {/* Left shadowed lapel vs right lit lapel */}
      <path
        d={`M108 208 L${108 - lapelWidth} 252 L134 282 L140 262 Z`}
        fill={arch.accentHex}
        opacity="0.94"
      />
      <path
        d={`M108 208 L${108 - lapelWidth} 252 L134 282 L140 262 Z`}
        fill="#000000"
        opacity="0.16"
      />
      <path
        d={`M172 208 L${172 + lapelWidth} 252 L146 282 L140 262 Z`}
        fill={arch.accentHex}
        opacity="0.9"
      />
      <path
        d={`M172 208 L${172 + lapelWidth} 252`}
        stroke={palette.rim}
        strokeWidth="1.2"
        strokeOpacity="0.35"
        fill="none"
      />

      {identity.accessoryDetail >= 35 && (
        <g>
          <polygon
            points="178,252 198,246 196,262 178,262"
            fill={`url(#${ids.frameGrad})`}
            opacity="0.92"
          />
          {identity.archetype === "arcane_fantasy" && (
            <g>
              <circle cx="140" cy="238" r="7.5" fill={`url(#${ids.frameGrad})`} stroke="#FEF3C7" strokeWidth="1.4" />
              <circle cx="140" cy="238" r="3" fill={palette.iris[0]} />
            </g>
          )}
        </g>
      )}

      {/* Neck with vertical gradient & soft under-chin shadow */}
      <rect
        x={gender === "feminine" ? "125" : "122"}
        y="176"
        width={gender === "feminine" ? "30" : "36"}
        height="42"
        rx="14"
        fill={`url(#${ids.neckGrad})`}
      />
      <path
        d={
          gender === "feminine"
            ? "M125 186 Q140 202 155 186 L155 196 Q140 208 125 196 Z"
            : "M122 186 Q140 203 158 186 L158 197 Q140 210 122 197 Z"
        }
        fill={palette.skinShadow}
        opacity="0.52"
        filter={`url(#${ids.softBlur})`}
      />

      {/* Ears with inner shadow contours */}
      <g>
        <ellipse cx="88" cy="136" rx="9" ry="15" fill={`url(#${ids.skinGrad})`} />
        <ellipse cx="88.5" cy="137" rx="4.5" ry="9" fill={palette.skinShadow} opacity="0.42" />
        <ellipse cx="192" cy="136" rx="9" ry="15" fill={`url(#${ids.skinGrad})`} />
        <ellipse cx="191.5" cy="137" rx="4.5" ry="9" fill={palette.skinShadow} opacity="0.42" />
      </g>

      {/* Head Base + Clipped Studio Highlights & Left Rim Lighting */}
      <path d={facePathD} fill={`url(#${ids.skinGrad})`} />
      <g clipPath={`url(#${ids.faceClip})`} pointerEvents="none">
        {/* Forehead soft specular light */}
        <ellipse
          cx="132"
          cy="98"
          rx="26"
          ry="13"
          fill="#FFFFFF"
          opacity="0.14"
          filter={`url(#${ids.softBlur})`}
        />
        {/* Right-cheekbone warm studio fill */}
        <ellipse
          cx="166"
          cy="144"
          rx="14"
          ry="9"
          fill={palette.skin[0]}
          opacity="0.28"
          filter={`url(#${ids.softBlur})`}
        />
        {/* Left-cheekbone subtle contour */}
        <ellipse
          cx="114"
          cy="146"
          rx="13"
          ry="8"
          fill={palette.skin[0]}
          opacity="0.2"
          filter={`url(#${ids.softBlur})`}
        />
        {/* Jaw underside subtle depth */}
        <path
          d="M95 174 Q140 198 185 174 L185 198 L95 198 Z"
          fill={palette.skinShadow}
          opacity="0.24"
          filter={`url(#${ids.softBlur})`}
        />
        {/* Underside hairline cast shadow */}
        <path
          d="M86 116 C98 92, 168 92, 194 116 L194 102 C172 86, 108 86, 86 102 Z"
          fill={palette.skinShadow}
          opacity="0.32"
          filter={`url(#${ids.softBlur})`}
        />
        {/* Directional left rim-light edge */}
        <path d={facePathD} fill={`url(#${ids.rimGrad})`} />
        <path
          d="M93 114 C93 92, 108 79, 132 76"
          stroke={palette.rim}
          strokeWidth="2.4"
          strokeOpacity="0.48"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {effectiveDecade >= 2 && (
        <g stroke={palette.skinShadow} strokeWidth="1.3" fill="none" opacity={effectiveDecade === 2 ? 0.45 : 0.72}>
          <path d="M104 148 Q106 160 112 166" />
          <path d="M176 148 Q174 160 168 166" />
        </g>
      )}

      {/* Layered Hair: Base Gradient + Shadow + Top Sheen + Flyaways + Age Silvering */}
      <g>
        <path
          d={`M86 122 C82 ${90 - hairTopHeight * 0.4}, 102 ${54 - hairTopHeight * 0.25}, 140 ${54 - hairTopHeight * 0.25} C178 ${54 - hairTopHeight * 0.25}, 198 ${90 - hairTopHeight * 0.4}, 194 122 C188 94, 166 86, 140 88 C114 86, 92 94, 86 122 Z`}
          fill={`url(#${ids.hairGrad})`}
        />
        <path
          d={`M102 88 C122 70, 164 74, 178 96 C158 84, 128 84, 102 88 Z`}
          fill={`url(#${ids.hairGrad})`}
        />
        {/* Hair top silk sheen */}
        <path
          d={`M105 ${72 - hairTopHeight * 0.12} Q140 ${58 - hairTopHeight * 0.2} 174 ${74 - hairTopHeight * 0.12}`}
          stroke={palette.hairHighlight}
          strokeWidth="3.2"
          strokeOpacity={silverOpacity > 0.6 ? 0.28 : 0.55}
          fill="none"
          strokeLinecap="round"
        />
        {/* Flyaway organic strands */}
        <path
          d={`M114 ${56 - hairTopHeight * 0.18} Q122 ${46 - hairTopHeight * 0.2} 131 ${53 - hairTopHeight * 0.18}`}
          stroke={palette.hair[0]}
          strokeWidth="1.2"
          strokeOpacity="0.65"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={`M156 ${55 - hairTopHeight * 0.18} Q166 ${47 - hairTopHeight * 0.2} 173 ${57 - hairTopHeight * 0.16}`}
          stroke={palette.hair[0]}
          strokeWidth="1.1"
          strokeOpacity="0.58"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M88 112 Q84 120 87 128"
          stroke={palette.hair[1]}
          strokeWidth="1.1"
          strokeOpacity="0.5"
          fill="none"
          strokeLinecap="round"
        />
        {silverOpacity > 0 && (
          <g fill="#CBD5E1" opacity={silverOpacity}>
            <path d="M88 120 C87 104, 94 94, 102 90 C97 102, 95 112, 92 122 Z" />
            <path d="M192 120 C193 104, 186 94, 178 90 C183 102, 185 112, 188 122 Z" />
            {effectiveDecade === 3 && (
              <path d="M114 70 C130 62, 154 62, 170 72 C154 68, 130 68, 114 70 Z" />
            )}
          </g>
        )}
      </g>

      {/* Eyebrows */}
      <path
        d={
          gesture === "concerned_tilt"
            ? "M104 118 Q116 112 128 117"
            : gesture === "curious_brow"
            ? "M104 111 Q116 104 128 111"
            : gesture === "smirk"
            ? "M104 117 Q116 113 128 116"
            : "M104 116 Q116 110 128 115"
        }
        stroke={palette.hair[1]}
        strokeWidth={browStrokeWidth}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={
          gesture === "concerned_tilt"
            ? "M152 117 Q164 112 176 118"
            : gesture === "smirk"
            ? "M152 112 Q164 106 176 114"
            : gesture === "curious_brow"
            ? "M152 115 Q164 110 176 115"
            : "M152 115 Q164 110 176 116"
        }
        stroke={palette.hair[1]}
        strokeWidth={browStrokeWidth}
        strokeLinecap="round"
        fill="none"
      />

      {/* Eyes: Socket Shadows + Multi-Stop Iris + Dual Catchlights */}
      <g>
        <ellipse
          cx="116"
          cy="128.5"
          rx="10.5"
          ry="7.5"
          fill={palette.eyeShadow}
          opacity="0.16"
          filter={`url(#${ids.softBlur})`}
        />
        <ellipse
          cx="164"
          cy="128.5"
          rx="10.5"
          ry="7.5"
          fill={palette.eyeShadow}
          opacity="0.16"
          filter={`url(#${ids.softBlur})`}
        />
        {gesture === "laugh" ? (
          <>
            <path d="M107 130 Q116 123 125 130" stroke="#1F2937" strokeWidth="2.8" fill="none" strokeLinecap="round" />
            <path d="M155 130 Q164 123 173 130" stroke="#1F2937" strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </>
        ) : isBlinking ? (
          <>
            <path d="M108 129 Q116 132 124 129" stroke="#1F2937" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M156 129 Q164 132 172 129" stroke="#1F2937" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            {/* Left eye */}
            <ellipse cx="116" cy="129" rx="7.0" ry="5.6" fill="#F8FAFC" />
            <circle cx="116" cy="129" r="3.9" fill={`url(#${ids.irisGrad})`} />
            <circle cx="116" cy="129" r="1.9" fill="#0F172A" />
            <circle cx="117.7" cy="127.4" r="1.35" fill="#FFFFFF" opacity="0.95" />
            <circle cx="114.6" cy="130.6" r="0.65" fill="#FFFFFF" opacity="0.58" />
            <path
              d="M108.5 126.5 Q116 122 123.5 126.5"
              stroke="#1E293B"
              strokeWidth={gender === "feminine" ? "2.0" : "1.4"}
              strokeOpacity={gender === "feminine" ? "0.9" : "0.55"}
              fill="none"
              strokeLinecap="round"
            />
            {gesture === "wink" ? (
              <path
                d="M154 130 Q164 123 174 130"
                stroke="#1F2937"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            ) : (
              <>
                {/* Right eye */}
                <ellipse cx="164" cy="129" rx="7.0" ry="5.6" fill="#F8FAFC" />
                <circle cx="164" cy="129" r="3.9" fill={`url(#${ids.irisGrad})`} />
                <circle cx="164" cy="129" r="1.9" fill="#0F172A" />
                <circle cx="165.7" cy="127.4" r="1.35" fill="#FFFFFF" opacity="0.95" />
                <circle cx="162.6" cy="130.6" r="0.65" fill="#FFFFFF" opacity="0.58" />
                <path
                  d="M156.5 126.5 Q164 122 171.5 126.5"
                  stroke="#1E293B"
                  strokeWidth={gender === "feminine" ? "2.0" : "1.4"}
                  strokeOpacity={gender === "feminine" ? "0.9" : "0.55"}
                  fill="none"
                  strokeLinecap="round"
                />
              </>
            )}
          </>
        )}
      </g>

      {renderEyewear()}

      {/* Nose with Bridge Highlight & Soft Nostril Shading */}
      <g>
        <path
          d="M139.5 128 L137.5 147"
          stroke={palette.skin[0]}
          strokeWidth="1.2"
          strokeOpacity="0.48"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M140 128 L137 148 Q140 151 145 148"
          stroke={palette.skinShadow}
          strokeWidth="1.9"
          fill="none"
          strokeLinecap="round"
        />
        <ellipse cx="140.5" cy="147.5" rx="3" ry="1.8" fill={palette.lip[0]} opacity="0.16" />
        <ellipse cx="137.2" cy="149.8" rx="1.4" ry="0.9" fill={palette.skinShadow} opacity="0.45" />
        <ellipse cx="143.4" cy="149.8" rx="1.4" ry="0.9" fill={palette.skinShadow} opacity="0.45" />
      </g>

      {renderMouth()}

      {gesture === "thumbs_up" && !compact && (
        <motion.g
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          <rect x="208" y="216" width="24" height="32" rx="10" fill={`url(#${ids.skinGrad})`} stroke={palette.skinShadow} strokeWidth="1.5" />
          <path
            d="M217 216 L217 195 C217 189, 226 189, 226 196 L226 216"
            fill={`url(#${ids.skinGrad})`}
            stroke={palette.skinShadow}
            strokeWidth="1.5"
          />
        </motion.g>
      )}
    </motion.svg>
  );
}

export function CompanionStageAvatar({
  identity,
  gesture,
  speechText,
  viewMode,
  framing,
  onChangeFraming,
  isSpeaking = false,
  speechEnergy = 0,
  speechViseme = "closed",
  rigConfig = DEFAULT_RIG_MOTION_CONFIG,
  onToggleViewMode,
  onOpenShareModal,
}: CompanionStageAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const capture3dRef = useRef<(() => string | null) | null>(null);
  const rigSvgRef = useRef<SVGSVGElement | null>(null);
  const portraitImgRef = useRef<HTMLImageElement | null>(null);

  const arch = ARCHETYPES[identity.archetype];
  const decadeSpec = DECADE_STAGES[identity.decadeStage] || DECADE_STAGES[0];
  const gestureMeta = GESTURE_LABELS[gesture];

  const activeFraming: AvatarFraming =
    framing || identity.cameraFraming || "half_body";

  const isMaturing = identity.maturityMode !== "timeless";
  const effectivePortraitDecade = isMaturing ? identity.decadeStage : 0;
  const portraitFilter =
    effectivePortraitDecade === 0
      ? "contrast(1.0)"
      : effectivePortraitDecade === 1
      ? "contrast(1.04) saturate(0.95)"
      : effectivePortraitDecade === 2
      ? "contrast(1.06) sepia(0.12) saturate(0.9)"
      : "contrast(1.08) sepia(0.22) saturate(0.84)";

  const portraitScaleClass =
    activeFraming === "headshot"
      ? "scale-125 origin-top"
      : activeFraming === "full_body"
      ? "scale-95 origin-center"
      : "scale-100 origin-center";

  const bgSpec = identity.backgroundSpec || DEFAULT_BACKGROUND_SPEC;

  function triggerPngDownload(dataUrl: string) {
    const slug = (identity.primaryName || "companion")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "companion";
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${slug}-aip-portrait.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleExportPng() {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      if (viewMode === "3d" && capture3dRef.current) {
        const dataUrl = capture3dRef.current();
        if (dataUrl) {
          triggerPngDownload(dataUrl);
          return;
        }
      }

      if (viewMode === "portrait" && portraitImgRef.current && !imgError) {
        const imgEl = portraitImgRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = 900;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#090D16";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.filter = portraitFilter;
          const aspect = imgEl.naturalWidth / Math.max(1, imgEl.naturalHeight);
          const drawH = canvas.height;
          const drawW = drawH * aspect;
          const dx = (canvas.width - drawW) / 2;
          ctx.drawImage(imgEl, dx, 0, drawW, drawH);
          triggerPngDownload(canvas.toDataURL("image/png"));
          return;
        }
      }

      if (rigSvgRef.current) {
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(rigSvgRef.current);
        const svgBlob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("SVG rasterization failed"));
            img.src = url;
          });
          const canvas = document.createElement("canvas");
          canvas.width = 900;
          canvas.height = 980;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
            grad.addColorStop(0, bgSpec.skyTopHex || "#090D16");
            grad.addColorStop(1, bgSpec.skyBottomHex || "#0F172A");
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            triggerPngDownload(canvas.toDataURL("image/png"));
          }
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    } catch {
      // ignore rasterization error
    } finally {
      setExportBusy(false);
    }
  }

  async function handleCopyShareLink() {
    const shareUrl = buildShareUrl(identity);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2400);
    } catch {
      // ignore clipboard errors cleanly
    }
  }

  return (
    <div className="bg-surface border border-edge rounded-2xl overflow-hidden">
      {/* Stage Top Strip */}
      <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-edge">
        <div className="flex items-center gap-2 text-xs text-ink-muted min-w-0">
          <span className="font-semibold text-ink truncate">
            {identity.primaryName}
          </span>
          {identity.activeNickname && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">"{identity.activeNickname}"</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="truncate">{arch.shortLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{bgSpec.title}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular whitespace-nowrap">
            {isMaturing ? `${decadeSpec.eraLabel} (${decadeSpec.ageRange})` : "Timeless Look"}
          </span>
        </div>

        {onToggleViewMode && (
          <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => onToggleViewMode("3d")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === "3d"
                  ? "bg-surface text-ink ring-1 ring-edge"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              3D Studio
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode("rig")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === "rig"
                  ? "bg-surface text-ink ring-1 ring-edge"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              2D Rig
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode("portrait")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === "portrait"
                  ? "bg-surface text-ink ring-1 ring-edge"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              Portrait
            </button>
          </div>
        )}
      </div>

      {/* Main Visual Canvas */}
      <div
        className="relative p-5 sm:p-6 transition-colors duration-300"
        style={{
          background:
            bgSpec.propTheme === "minimal"
              ? undefined
              : `linear-gradient(180deg, ${bgSpec.skyTopHex}24 0%, ${bgSpec.skyBottomHex}32 100%)`,
        }}
      >
        {viewMode === "3d" ? (
          <div className="space-y-5">
            <CompanionAvatar3D
              identity={identity}
              gesture={gesture}
              framing={activeFraming}
              onChangeFraming={onChangeFraming}
              isSpeaking={isSpeaking}
              speechEnergy={speechEnergy}
              speechViseme={speechViseme}
              rigConfig={rigConfig}
              heightClass="h-[380px] sm:h-[430px]"
              onRegisterCapture={(fn) => {
                capture3dRef.current = fn;
              }}
            />

            <div className="bg-surface-alt border border-edge rounded-xl p-4 sm:p-5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-accent-ink">
                    {gestureMeta.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{gestureMeta.cue}</span>
                </div>
                <div>
                  <span className="font-medium text-ink">
                    {decadeSpec.title}:
                  </span>{" "}
                  {decadeSpec.visualNote}
                </div>
              </div>
              <blockquote className="text-[15px] leading-relaxed text-ink">
                {speechText}
              </blockquote>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
              {/* Dark Studio Portrait Stage (always #090d16 across Dark, Dim, and Light themes) */}
              <div className="md:col-span-6 relative rounded-2xl bg-[#090D16] border border-[#1E293B] p-4 flex items-center justify-center overflow-hidden">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-10 rounded-full opacity-15 blur-3xl dark:opacity-30 dark:blur-2xl"
                  style={{ backgroundColor: arch.accentHex }}
                />
                {viewMode === "rig" ? (
                  <div className="relative z-10 w-full max-w-[290px]">
                    <LiveRigSvg
                      svgRef={rigSvgRef}
                      identity={identity}
                      gesture={gesture}
                      framing={activeFraming}
                      isSpeaking={isSpeaking}
                      speechEnergy={speechEnergy}
                      speechViseme={speechViseme}
                      rigConfig={rigConfig}
                    />
                  </div>
                ) : (
                  <div className="relative z-10 w-full max-w-[280px] aspect-[3/4] rounded-xl overflow-hidden border border-[#1E293B] bg-[#090D16]">
                    {!imgError ? (
                      <img
                        ref={portraitImgRef}
                        src={arch.portraitUrl}
                        alt={`${identity.primaryName} — ${arch.label} portrait`}
                        referrerPolicy="no-referrer"
                        onError={() => setImgError(true)}
                        style={{ filter: portraitFilter }}
                        className={`w-full h-full object-cover transition-all duration-300 ${portraitScaleClass}`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-[#090D16]">
                        <LiveRigSvg
                          svgRef={rigSvgRef}
                          identity={identity}
                          gesture={gesture}
                          framing={activeFraming}
                          isSpeaking={isSpeaking}
                          speechEnergy={speechEnergy}
                          speechViseme={speechViseme}
                          rigConfig={rigConfig}
                          compact
                        />
                        <span className="mt-2 text-xs font-medium text-slate-300">
                          {arch.label}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Speech Bubble & Core Promise */}
              <div className="md:col-span-6 space-y-4">
                <div className="text-xs text-ink-muted flex items-center gap-2">
                  <span className="font-medium text-accent-ink">
                    {gestureMeta.label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{gestureMeta.cue}</span>
                </div>

                <blockquote className="bg-surface-alt border border-edge rounded-xl p-4 sm:p-5 text-[15px] leading-relaxed text-ink">
                  {speechText}
                </blockquote>

                <div className="text-xs text-ink-muted leading-relaxed">
                  <span className="font-medium text-ink">
                    {decadeSpec.title}:
                  </span>{" "}
                  {decadeSpec.visualNote}
                </div>
              </div>
            </div>

            {onChangeFraming && (
              <div className="flex items-center justify-between pt-2 border-t border-edge">
                <span className="text-xs text-ink-muted">Camera Framing</span>
                <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg">
                  {AVATAR_FRAMING_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onChangeFraming(opt.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        activeFraming === opt.id
                          ? "bg-surface text-ink ring-1 ring-edge"
                          : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stage Export & Share Footer */}
      <div className="px-5 py-3 border-t border-edge bg-surface-alt flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] text-ink-muted">
          {APP_COPY.share.buttonTooltip}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={exportBusy}
            onClick={handleExportPng}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-surface border border-edge rounded-lg text-ink-secondary hover:border-edge-strong hover:text-ink disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            {exportBusy ? "Exporting..." : "Export PNG"}
          </button>
          <button
            type="button"
            title={APP_COPY.share.buttonTooltip}
            aria-label={APP_COPY.share.buttonLabel}
            onClick={() => {
              if (onOpenShareModal) {
                onOpenShareModal();
              } else {
                void handleCopyShareLink();
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-accent-fg rounded-lg hover:bg-accent-hover whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            {shareCopied && !onOpenShareModal ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Link Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5" />
                <span>{APP_COPY.share.buttonLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
