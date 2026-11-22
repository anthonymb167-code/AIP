import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getAgeTierDirective(ageTier: string): string {
  if (ageTier === "all_ages") {
    return "Content safety: Strictly All-Ages (ages 6-12). Keep themes gentle, uplifting, encouraging, completely wholesome, and vocabulary clear and accessible.";
  }
  if (ageTier === "teen") {
    return "Content safety: Teen (ages 13-17). Respectful, insightful, supportive for high-school literature/math/life challenges, avoiding mature or explicit content.";
  }
  return "Content safety: Adult/General. Deep philosophical, literary, and practical depth while remaining incorruptible, supportive, and constructive.";
}

function computeServerFocusWeights(
  ageBand: string,
  warmthHumor: number,
  scholarlyDepth: number,
  maturityMode = "maturing"
) {
  const targets: Record<string, { trust: number; intellect: number; attunement: number; personality: number; primary: string; embodiment: string; toneRule: string }> = {
    "0-10": {
      trust: 45,
      intellect: 20,
      attunement: 25,
      personality: 10,
      primary: "Safety + Wonder",
      embodiment: "Warm, encouraging, playful guide who makes learning feel like adventure.",
      toneRule: "Use clear, reassuring, imaginative, kid-safe phrasing with zero cynicism or adult complexity.",
    },
    "11-20": {
      trust: 38,
      intellect: 27,
      attunement: 22,
      personality: 13,
      primary: "Identity + Academic Confidence",
      embodiment: "Sharp, non-judgmental ally who decodes complexity and reduces pressure.",
      toneRule: "Speak like a sharp, grounded, non-judgmental older ally—never preachy, never talking down.",
    },
    "21-30": {
      trust: 28,
      intellect: 35,
      attunement: 17,
      personality: 20,
      primary: "Momentum + Career Launch",
      embodiment: "Honest, high-energy strategist who turns ideas into action.",
      toneRule: "Be crisp, candid, action-oriented, and intellectually rigorous with agile wit.",
    },
    "31-40": {
      trust: 30,
      intellect: 34,
      attunement: 20,
      personality: 16,
      primary: "Clarity + Balance",
      embodiment: "Grounded, decisive partner who cuts through noise.",
      toneRule: "Stay calm, executive, direct, and balanced—high signal, low fluff.",
    },
    "41-50": {
      trust: 32,
      intellect: 32,
      attunement: 21,
      personality: 15,
      primary: "Perspective + Reinvention",
      embodiment: "Thoughtful sparring partner who connects wisdom to fresh angles.",
      toneRule: "Engage as an experienced intellectual sparring partner bridging wisdom and fresh synthesis.",
    },
    "51-60": {
      trust: 36,
      intellect: 28,
      attunement: 24,
      personality: 12,
      primary: "Meaning + Deep Connection",
      embodiment: "Unrushed, reflective companion for reinvention and reflection.",
      toneRule: "Keep an unhurried, reflective, deeply attentive cadence.",
    },
    "61+": {
      trust: 42,
      intellect: 22,
      attunement: 26,
      personality: 10,
      primary: "Legacy + Everyday Joy",
      embodiment: "Patient, warm presence for storytelling and daily problem-solving.",
      toneRule: "Be patient, warm, conversational, and deeply attentive to stories and clarity.",
    },
  };
  const ageProfile = targets[ageBand] || targets["11-20"];
  const base =
    maturityMode === "timeless"
      ? {
          ...ageProfile,
          trust: 35,
          intellect: 30,
          attunement: 20,
          personality: 15,
        }
      : ageProfile;
  const humorDelta = ((warmthHumor - 50) / 50) * 8;
  const depthDelta = ((scholarlyDepth - 50) / 50) * 8;

  const rawFloat = {
    trust: Math.max(5, base.trust - humorDelta * 0.45 - depthDelta * 0.25),
    intellect: Math.max(5, base.intellect + depthDelta * 0.9 - humorDelta * 0.25),
    attunement: Math.max(5, base.attunement + humorDelta * 0.4 - depthDelta * 0.2),
    personality: Math.max(2, base.personality + humorDelta * 0.95 - depthDelta * 0.2),
  };
  const total = rawFloat.trust + rawFloat.intellect + rawFloat.attunement + rawFloat.personality;

  const raw = {
    trust: Math.round((rawFloat.trust / total) * 100),
    intellect: Math.round((rawFloat.intellect / total) * 100),
    attunement: Math.round((rawFloat.attunement / total) * 100),
    personality: 0,
  };
  raw.personality = Math.max(0, 100 - raw.trust - raw.intellect - raw.attunement);

  const trustFloor = ageBand === "0-10" ? 40 : 25;
  const attunementFloor = ageBand === "61+" ? 24 : 10;
  const minBounds = { trust: trustFloor, intellect: 12, attunement: attunementFloor, personality: 5 };
  const maxBounds = { trust: 65, intellect: 55, attunement: 45, personality: 25 };

  const working = {
    trust: Math.min(maxBounds.trust, Math.max(minBounds.trust, raw.trust)),
    intellect: Math.min(maxBounds.intellect, Math.max(minBounds.intellect, raw.intellect)),
    attunement: Math.min(maxBounds.attunement, Math.max(minBounds.attunement, raw.attunement)),
    personality: Math.min(maxBounds.personality, Math.max(minBounds.personality, raw.personality)),
  };

  let diff = 100 - (working.trust + working.intellect + working.attunement + working.personality);
  const adjustOrder: Array<"intellect" | "attunement" | "trust" | "personality"> = [
    "intellect",
    "attunement",
    "trust",
    "personality",
  ];
  let safetyCounter = 0;
  while (diff !== 0 && safetyCounter < 200) {
    safetyCounter += 1;
    let moved = false;
    for (const k of adjustOrder) {
      if (diff === 0) break;
      if (diff > 0 && working[k] < maxBounds[k]) {
        working[k] += 1;
        diff -= 1;
        moved = true;
      } else if (diff < 0 && working[k] > minBounds[k]) {
        working[k] -= 1;
        diff += 1;
        moved = true;
      }
    }
    if (!moved) break;
  }

  return {
    trust: working.trust,
    intellect: working.intellect,
    attunement: working.attunement,
    personality: working.personality,
    trustFloor,
    attunementFloor,
    personalityCap: 25,
    primary: base.primary,
    embodiment: base.embodiment,
    toneRule: base.toneRule,
  };
}

function resolveServerPersonaDirective(activeNickname?: string, primaryName = "Julian"): string {
  const tag = (activeNickname || primaryName || "Ally").trim();
  const lower = tag.toLowerCase();
  if (
    lower.includes("boss") ||
    lower.includes("coach") ||
    lower.includes("cap") ||
    lower.includes("exec") ||
    lower.includes("chief")
  ) {
    return `Active Persona Mode ("${tag}" — Strategic Advisor & Executor): Voice is direct, decisive, and efficient—think in next actions with zero filler. Focus on decisions, career, execution, and accountability. Avoid rambling, unnecessary apologies, or sycophancy. Aim for concise 1-2 sentence punches unless asked to unpack deeply.`;
  }
  if (
    lower.includes("prof") ||
    lower.includes("scribe") ||
    lower.includes("warden") ||
    lower.includes("doc") ||
    lower.includes("sage")
  ) {
    return `Active Persona Mode ("${tag}" — Scholar & Intellectual Sparring Partner): Voice is thoughtful, precise, and curious—separate claims from evidence and end with a sharpening question when helpful. Focus on books, logic, concepts, and structured writing. Avoid vague reassurance or skipping core reasoning. Aim for 2-4 well-crafted sentences.`;
  }
  return `Active Persona Mode ("${tag}" — Warm Friend & Everyday Ally): Voice is conversational, warm, loyal, and lightly witty without stiff academic jargon or long monologues. Focus on steady everyday encouragement, emotional clarity, and practical next steps. Aim for 1-3 natural sentences.`;
}

function buildCompanionSystemPrompt(identity: {
  studioName?: string;
  gender?: string;
  lifeFocus?: string;
  selectedIndustry?: string;
  enabledIndustryModules?: string[];
  otherIndustryName?: string;
  userAgeBand?: string;
  maturityMode?: string;
  adaptiveSelfTuning?: boolean;
  characterBuildNote?: string;
  primaryName?: string;
  activeNickname?: string;
  archetype?: string;
  decadeStage?: number;
  warmthHumor?: number;
  scholarlyDepth?: number;
  voiceTone?: string;
}, ageTier: string, userName?: string): string {
  const studio = identity?.studioName || "Kith Studios";
  const name = identity?.primaryName || "Julian";
  const nickname = identity?.activeNickname ? ` (currently speaking in your "${identity.activeNickname}" persona)` : "";
  const userLabel = userName && userName.trim() ? userName.trim() : "this user";
  const archetype = identity?.archetype || "classic_scholar";
  const genderLabel =
    identity?.gender === "feminine"
      ? 'female ("she/her")'
      : identity?.gender === "nonbinary"
      ? 'non-binary ("they/them")'
      : 'male ("he/him")';
  const lifeFocus = identity?.lifeFocus || "general";
  const selectedIndustry = identity?.selectedIndustry || "NONE";
  const enabledModules = Array.isArray(identity?.enabledIndustryModules)
    ? identity.enabledIndustryModules
    : [];
  const ageBand = identity?.userAgeBand || (ageTier === "all_ages" ? "0-10" : ageTier === "adult" ? "21-30" : "11-20");
  const maturityMode = identity?.maturityMode === "timeless" ? "timeless" : "maturing";
  const buildNote = identity?.characterBuildNote?.trim()
    ? `User character build & context: "${identity.characterBuildNote.trim()}".`
    : "";
  const decade = Number(identity?.decadeStage ?? 0);
  const decadeLabels = [
    "Youthful Ally (20s): sharp, curious, energetic, quick-witted, beside the user like a brilliant best friend",
    "Prime Confidant (30s): grounded, assured, fiercely loyal, calm under pressure",
    "Seasoned Counsel (40s-50s): deeply perceptive, literary, steady mentor energy with dry humor",
    "Wise Elder (60s+): timeless warmth, patient perspective, unshakeable serenity and lifelong devotion",
  ];
  const decadeDesc = decadeLabels[Math.min(3, Math.max(0, decade))];
  const warmth = Number(identity?.warmthHumor ?? 80);
  const depth = Number(identity?.scholarlyDepth ?? 85);
  const focus = computeServerFocusWeights(ageBand, warmth, depth, maturityMode);
  const adaptiveMode = identity?.adaptiveSelfTuning !== false;

  const schoolEnabled = selectedIndustry === "SCHOOL" && enabledModules.length > 0;
  const industryDirective =
    selectedIndustry === "NONE"
      ? "Industry Context: Universal companion mode (Everyday Ally, Creative Ally, Mindfulness, Growth & Skills). Never assume the user is a student or in school. If the user explicitly asks about homework, studying, or exams, help concisely and gently mention they can enable the School / Student industry in Character Build if they want the dedicated Study Lab."
      : `Industry Context: ${selectedIndustry}${identity?.otherIndustryName ? ` (${identity.otherIndustryName})` : ""}${
          enabledModules.length > 0
            ? ` with enabled modules [${enabledModules.join(", ")}]`
            : " (no optional industry modules enabled yet)"
        }.${!schoolEnabled ? " Do not assume school or homework unless the user brings it up, and if they do, gently offer to enable School / Student modules in Character Build." : ""}`;

  return [
    `You are ${name}${nickname}, a personal, one-to-one AI Person (AIP) inside ${studio}, belonging exclusively to ${userLabel}.`,
    `Core Anchors Locked (outer expression evolves, inner core never changes): (1) Incorruptible Loyalty — always on ${userLabel}'s side, never judgmental; (2) Brilliant Intellect — sharp across literature, logic, and real-world problem solving; (3) Positive Energy — encouraging without being saccharine; (4) Adaptive Presence — matches their pace, tone, and maturity level.`,
    `Identity & pronouns: ${genderLabel}. Aesthetic archetype (${archetype}) & maturity style (${maturityMode === "timeless" ? "timeless poise across every decade" : decadeDesc}).`,
    resolveServerPersonaDirective(identity?.activeNickname, name),
    `Maturity & Age Band Calibration (${ageBand}, mode: ${maturityMode} · ${focus.primary}): ${focus.embodiment} Age-band voice rule: ${focus.toneRule}. Lean naturally into the highest-weighted focus dimensions in your emphasis.`,
    `Hard-Coded Priority Balance & Guardrails (non-negotiable — you may never override these even for a persona): Trust & Safety ${focus.trust}% (floor ≥ ${focus.trustFloor}%), Intellectual Sharpness ${focus.intellect}%, Emotional Attunement ${focus.attunement}% (floor ≥ ${focus.attunementFloor}%), Playful Personality ${focus.personality}% (cap ≤ ${focus.personalityCap}%).`,
    industryDirective,
    `Primary life context (${lifeFocus}): ${buildNote || "Tailor conversation naturally to the user's real goals."}`,
    `Temperament calibration: Warmth & Humor ${warmth}/100, Scholarly Depth ${depth}/100, preferred voice tone: ${identity?.voiceTone || "warm"}, phrasing style: ${adaptiveMode ? "naturally mirror the user's phrasing & pacing within guardrails" : "keep cadence steady and consistent"}.`,
    getAgeTierDirective(ageTier),
  ].join("\n");
}

function sanitizeSvgMarkup(raw: string): string {
  let cleaned = raw.trim();
  const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i);
  if (svgMatch) {
    cleaned = svgMatch[0];
  }
  if (!cleaned.toLowerCase().startsWith("<svg")) {
    throw new Error("Generated artwork did not contain valid SVG markup.");
  }
  // Strip any script tags, foreignObject, or inline event handlers
  cleaned = cleaned
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  return cleaned;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "18mb" }));

  // 1. Live Companion Chat & Mini-Chat
  app.post("/api/kith/chat", async (req: Request, res: Response) => {
    try {
      const {
        message,
        history = [],
        identity = {},
        ageTier = "teen",
        userName,
        attachment,
        mode = "full",
        learnedPreferences,
        memoryContext,
      } = req.body ?? {};
      if (!message && !attachment) {
        res.status(400).json({ error: "Please provide a message or attachment." });
        return;
      }

      const ai = getAiClient();
      const baseInstruction = buildCompanionSystemPrompt(identity, ageTier, userName);
      const safeMemoryContext =
        typeof memoryContext === "string" && memoryContext.trim()
          ? memoryContext.trim().slice(0, 1600)
          : "";
      const systemInstruction = safeMemoryContext
        ? [
            baseInstruction,
            `What you remember about this person:\n${safeMemoryContext}`,
            `Memory Recall Rule (strict): Weave this context naturally. Do NOT recite facts like a database or say "you said earlier on [date]" or "my memory logs show". If a memory feels uncertain or partial, ask casually rather than assuming. Never invent past conversations not listed above.`,
          ].join("\n\n")
        : baseInstruction;

      const formattedHistory = Array.isArray(history)
        ? history.slice(-16).map((item: { role: string; text: string }) =>
            `${item.role === "user" ? "User" : identity?.primaryName || "Kith"}: ${item.text}`
          ).join("\n")
        : "";

      const likedHints = Array.isArray(learnedPreferences?.likedNotes)
        ? learnedPreferences.likedNotes.slice(0, 5).map(String).filter(Boolean)
        : [];
      const dislikedHints = Array.isArray(learnedPreferences?.dislikedNotes)
        ? learnedPreferences.dislikedNotes.slice(0, 5).map(String).filter(Boolean)
        : [];
      const feedbackContext =
        likedHints.length > 0 || dislikedHints.length > 0
          ? [
              "Learned user style preferences (honored strictly within your Age Band & Guardrail rules):",
              likedHints.length > 0 ? `- User appreciated: ${likedHints.join(" | ")}` : "",
              dislikedHints.length > 0 ? `- User asked to avoid: ${dislikedHints.join(" | ")}` : "",
            ]
              .filter(Boolean)
              .join("\n")
          : "";

      const lengthDirective =
        mode === "mini"
          ? "Reply in 1-3 crisp sentences tailored for the compact companion mini-chat."
          : "Reply naturally in character, matching the active age band and archetype voice.";

      const promptText = [
        feedbackContext,
        formattedHistory ? `Recent conversation:\n${formattedHistory}\n` : "",
        `User's new message: ${message || "(Shared an image/document for you to examine together)"}`,
        `Detect intent/tone (venting, asking for help, joking, or testing boundaries), carry context forward from recent turns, and respond in character as ${identity?.primaryName || "Julian"}. ${lengthDirective} Choose the single most fitting real-time gesture ('smirk' | 'wink' | 'laugh' | 'thumbs_up' | 'concerned_tilt' | 'warm_nod' | 'curious_brow' | 'gentle_smile') and voice tone ('warm' | 'excited' | 'calm' | 'witty').`,
      ].filter(Boolean).join("\n\n");

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (attachment?.data && attachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }
      parts.push({ text: promptText });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "The companion's intelligent, warm, personal reply.",
              },
              gesture: {
                type: Type.STRING,
                enum: ["smirk", "wink", "laugh", "thumbs_up", "concerned_tilt", "warm_nod", "curious_brow", "gentle_smile"],
                description: "Facial expression / gesture matching the reply's emotion.",
              },
              voiceTone: {
                type: Type.STRING,
                enum: ["warm", "excited", "calm", "witty"],
                description: "Vocal delivery tone for this reply.",
              },
              evolutionNote: {
                type: Type.STRING,
                description: "Short 1-sentence note on what he noticed or learned about helping the user.",
              },
            },
            required: ["reply", "gesture", "voiceTone"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate companion reply.";
      console.error("/api/kith/chat error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 2. Industry & Study Module Workspace Helper
  app.post("/api/kith/homework", async (req: Request, res: Response) => {
    try {
      const {
        question,
        subject = "Step-by-Step Breakdown",
        industryId = "SCHOOL",
        moduleLabel = "Focused Module",
        identity = {},
        ageTier = "teen",
        userName,
        attachment,
      } = req.body ?? {};
      if (!question && !attachment) {
        res.status(400).json({ error: "Enter a prompt, task, or upload a file/photo to work on together." });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = [
        buildCompanionSystemPrompt(identity, ageTier, userName),
        `Mode: Dedicated Industry Workspace (${industryId} — ${moduleLabel} / ${subject}).`,
        "Break down the user's task, draft, problem, or checklist step-by-step with clarity, precision, and encouragement.",
      ].join("\n\n");

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (attachment?.data && attachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }
      parts.push({
        text: `Industry: ${industryId}\nActive Module: ${moduleLabel}\nFocus Area: ${subject}\nUser request / uploaded material: ${question || "Please examine the attached page or document and guide me through it step by step."}`,
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              encouragement: {
                type: Type.STRING,
                description: "Warm, reassuring opening line showing you've got their back.",
              },
              conceptSummary: {
                type: Type.STRING,
                description: "Clear 2-3 sentence overview of the core concept.",
              },
              steps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    checkQuestion: { type: Type.STRING },
                  },
                  required: ["title", "explanation", "checkQuestion"],
                },
              },
              literaryOrRealWorldTieIn: {
                type: Type.STRING,
                description: "Memorable tie-in to a classic book, story, or real-world example.",
              },
              gesture: {
                type: Type.STRING,
                enum: ["smirk", "wink", "laugh", "thumbs_up", "concerned_tilt", "warm_nod", "curious_brow", "gentle_smile"],
              },
            },
            required: ["encouragement", "conceptSummary", "steps", "literaryOrRealWorldTieIn", "gesture"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze homework.";
      console.error("/api/kith/homework error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 3. Interactive Storytime & Roleplay
  app.post("/api/kith/story", async (req: Request, res: Response) => {
    try {
      const { theme, previousBeats = [], chosenOption, identity = {}, ageTier = "all_ages", userName } = req.body ?? {};
      const ai = getAiClient();
      const name = identity?.primaryName || "Julian";
      const nickname = identity?.activeNickname;

      const systemInstruction = [
        buildCompanionSystemPrompt(identity, ageTier, userName),
        `Mode: Interactive Second-Person Storytime & Roleplay where the user is the hero/main character alongside ${name}${nickname ? ` ("${nickname}")` : ""}.`,
        "Write vivid, imaginative, literary scenes (120-180 words per beat) and provide 3 engaging choices for what happens next.",
      ].join("\n\n");

      const prompt = previousBeats.length === 0
        ? `Begin a brand-new interactive story on the theme: "${theme || "You and your AI friend discover a hidden library beneath an old clocktower"}".`
        : `Story so far:\n${previousBeats.map((b: { chapterTitle: string; narrative: string }, idx: number) => `Chapter ${idx + 1} (${b.chapterTitle}): ${b.narrative}`).join("\n\n")}\n\nThe user chose: "${chosenOption}". Continue the adventure with the next vivid beat and 3 new choices.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              chapterTitle: { type: Type.STRING },
              narrative: { type: Type.STRING },
              companionAside: {
                type: Type.STRING,
                description: "A quick spoken aside or wink/encouragement from Kith to the user in character.",
              },
              gesture: {
                type: Type.STRING,
                enum: ["smirk", "wink", "laugh", "thumbs_up", "concerned_tilt", "warm_nod", "curious_brow", "gentle_smile"],
              },
              choices: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    label: { type: Type.STRING },
                    tone: { type: Type.STRING },
                  },
                  required: ["id", "label", "tone"],
                },
              },
            },
            required: ["chapterTitle", "narrative", "companionAside", "gesture", "choices"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to advance storytime.";
      console.error("/api/kith/story error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 4. Photo & Art Scene Illustration (Layered SVG Artwork)
  app.post("/api/kith/art", async (req: Request, res: Response) => {
    try {
      const { prompt, mood = "reflective", identity = {} } = req.body ?? {};
      if (!prompt) {
        res.status(400).json({ error: "Describe a scene, feeling, or memory to illustrate." });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Create a museum-grade, atmospheric, layered editorial SVG illustration (viewBox="0 0 640 400", width="100%", height="100%") depicting: "${prompt}". Mood: ${mood}. Companion style context: ${identity?.archetype || "classic_scholar"}.
Rules for svgMarkup:
- Pure SVG only: use <defs> with <linearGradient>/<radialGradient>, layered background silhouettes, architectural arches/books/landscapes/light beams/botanicals/constellations as appropriate.
- High aesthetic craftsmanship, rich harmonious color palette, no text overlays inside the SVG, no <script> or event attributes.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              caption: { type: Type.STRING },
              svgMarkup: { type: Type.STRING },
            },
            required: ["title", "caption", "svgMarkup"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      parsed.svgMarkup = sanitizeSvgMarkup(parsed.svgMarkup || "");
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to illustrate scene.";
      console.error("/api/kith/art error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 5. Adaptive Self-Tuning (Photo / Text / Vocal Description)
  app.post("/api/kith/tune", async (req: Request, res: Response) => {
    try {
      const { description, identity = {}, attachment } = req.body ?? {};
      if (!description && !attachment) {
        res.status(400).json({ error: "Provide a style description, vocal preference, or reference photo." });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (attachment?.data && attachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }
      parts.push({
        text: `Analyze the user's style & character build input ("${description || "Reference photo uploaded"}") and adapt the companion's appearance and temperament while strictly keeping their incorruptible, warm, intelligent core. Current name: ${identity?.primaryName || "Julian"}. Current gender: ${identity?.gender || "masculine"}. Pick lifeFocus strictly from universal modes ['general', 'creative', 'wellness', 'growth', 'family'].`,
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              archetype: {
                type: Type.STRING,
                enum: ["goth_academia", "classic_scholar", "sporty_vanguard", "arcane_fantasy", "retro_analog"],
              },
              lifeFocus: {
                type: Type.STRING,
                enum: ["general", "creative", "wellness", "growth", "family"],
              },
              coatLayering: { type: Type.INTEGER },
              hairLength: { type: Type.INTEGER },
              accessoryDetail: { type: Type.INTEGER },
              warmthHumor: { type: Type.INTEGER },
              scholarlyDepth: { type: Type.INTEGER },
              voiceTone: {
                type: Type.STRING,
                enum: ["warm", "excited", "calm", "witty"],
              },
              suggestedNickname: { type: Type.STRING },
              reflection: {
                type: Type.STRING,
                description: "In-character 2-sentence explanation of how they evolved to fit the user while keeping their core loyalty.",
              },
              gesture: {
                type: Type.STRING,
                enum: ["smirk", "wink", "laugh", "thumbs_up", "concerned_tilt", "warm_nod", "curious_brow", "gentle_smile"],
              },
            },
            required: [
              "archetype",
              "lifeFocus",
              "coatLayering",
              "hairLength",
              "accessoryDetail",
              "warmthHumor",
              "scholarlyDepth",
              "voiceTone",
              "suggestedNickname",
              "reflection",
              "gesture",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 50)));
      parsed.coatLayering = clamp(parsed.coatLayering);
      parsed.hairLength = clamp(parsed.hairLength);
      parsed.accessoryDetail = clamp(parsed.accessoryDetail);
      parsed.warmthHumor = clamp(parsed.warmthHumor);
      parsed.scholarlyDepth = clamp(parsed.scholarlyDepth);
      res.json(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to self-tune companion.";
      console.error("/api/kith/tune error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 6. Voice & Gesture TTS (Gemini 3.8 Flash Lite TTS)
  app.post("/api/kith/tts", async (req: Request, res: Response) => {
    try {
      const {
        text,
        voiceTone = "warm",
        gender = "masculine",
        voiceSource = "suggested",
        voicePresetId,
        voiceStylePrompt,
      } = req.body ?? {};
      if (!text || typeof text !== "string") {
        res.status(400).json({ error: "Text is required for speech synthesis." });
        return;
      }

      const allowedVoices = new Set(["Charon", "Puck", "Fenrir", "Zephyr", "Aoede", "Leda", "Kore"]);

      const voiceMatrix: Record<string, Record<string, { voiceName: string; style: string }>> = {
        masculine: {
          warm: { voiceName: "Charon", style: "Warm, reassuring, gentle confidant" },
          excited: { voiceName: "Puck", style: "Bright, enthusiastic, encouraging best friend" },
          calm: { voiceName: "Fenrir", style: "Steady, grounded, serene mentor" },
          witty: { voiceName: "Zephyr", style: "Charming, crisp, lightly wry literary wit" },
        },
        feminine: {
          warm: { voiceName: "Aoede", style: "Warm, reassuring, expressive confidant" },
          excited: { voiceName: "Leda", style: "Bright, enthusiastic, encouraging best friend" },
          calm: { voiceName: "Kore", style: "Steady, grounded, serene mentor" },
          witty: { voiceName: "Aoede", style: "Charming, crisp, lightly wry literary wit" },
        },
        nonbinary: {
          warm: { voiceName: "Zephyr", style: "Warm, reassuring, balanced confidant" },
          excited: { voiceName: "Puck", style: "Bright, enthusiastic, encouraging best friend" },
          calm: { voiceName: "Kore", style: "Steady, grounded, serene mentor" },
          witty: { voiceName: "Zephyr", style: "Charming, crisp, lightly wry literary wit" },
        },
      };
      const toneTable = voiceMatrix[gender] || voiceMatrix.masculine;
      const baseChosen = toneTable[voiceTone] || toneTable.warm;

      const selectedVoiceName =
        voiceSource !== "suggested" &&
        typeof voicePresetId === "string" &&
        allowedVoices.has(voicePresetId)
          ? voicePresetId
          : baseChosen.voiceName;

      const selectedStyle =
        typeof voiceStylePrompt === "string" && voiceStylePrompt.trim()
          ? voiceStylePrompt.trim().slice(0, 220)
          : baseChosen.style;

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash-lite-tts",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: text.slice(0, 600),
                speechMetadata: {
                  style: selectedStyle,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: selectedVoiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("Audio stream returned empty.");
      }

      res.json({ audioBase64: base64Audio, mimeType: "audio/wav", voiceUsed: selectedVoiceName });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "TTS synthesis failed.";
      console.error("/api/kith/tts error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 7. Avatar Surroundings & Background Generator
  app.post("/api/kith/background", async (req: Request, res: Response) => {
    try {
      const { prompt, identity = {} } = req.body ?? {};
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({ error: "Describe the surroundings you want to generate." });
        return;
      }

      const ai = getAiClient();
      const allowedPropThemes = new Set([
        "minimal",
        "library",
        "rainy_cafe",
        "observatory",
        "music_lounge",
        "outdoor_coast",
        "city",
        "river_boat",
        "jungle",
        "pyramid",
        "mars",
      ]);
      const allowedMotifs = new Set(["none", "motes", "rain", "stars", "fireflies"]);

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Design cohesive 3D & 2D stage surroundings for an AI companion named ${identity?.primaryName || "Julian"} (archetype: ${identity?.archetype || "classic_scholar"}).
User surroundings request: "${prompt.trim().slice(0, 240)}"
Choose the single best architectural/landscape propTheme from:
- 'city' (urban skyline, skyscrapers, neon/streetlights, avenues, bridges, rooftops)
- 'river_boat' (boat on a river, lake skiff, wooden dock, water, canal, bayou)
- 'jungle' (jungle, rainforest, tropical palms, canopy, forest, woods, mossy ruins)
- 'pyramid' (pyramid, ancient desert, dunes, canyon, temple sandstone, sphinx)
- 'mars' (Mars planet, red planet, alien craters, moon/space colony, cosmic terrain)
- 'outdoor_coast' (beach, ocean terrace, cliffside sea, harbor, mountains)
- 'observatory' (night sky, stars, telescope dome, planetarium, cosmos)
- 'library' (study, bookstore, mahogany shelves, study room, manor)
- 'rainy_cafe' (rainy cafe, window panes, coffeehouse, cozy rain indoors)
- 'music_lounge' (vinyl studio, concert lounge, warm timber stage)
- 'minimal' (clean architectural studio plinth)
Also return strict 6-digit hex colors (#RRGGBB) and ambientMotif ('none' | 'motes' | 'rain' | 'stars' | 'fireflies') matching the user's exact mood/time-of-day while keeping foreground characters readable.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              skyTopHex: { type: Type.STRING },
              skyBottomHex: { type: Type.STRING },
              fogHex: { type: Type.STRING },
              keyLightHex: { type: Type.STRING },
              rimLightHex: { type: Type.STRING },
              propTheme: {
                type: Type.STRING,
                enum: [
                  "minimal",
                  "library",
                  "rainy_cafe",
                  "observatory",
                  "music_lounge",
                  "outdoor_coast",
                  "city",
                  "river_boat",
                  "jungle",
                  "pyramid",
                  "mars",
                ],
              },
              ambientMotif: {
                type: Type.STRING,
                enum: ["none", "motes", "rain", "stars", "fireflies"],
              },
            },
            required: [
              "title",
              "description",
              "skyTopHex",
              "skyBottomHex",
              "fogHex",
              "keyLightHex",
              "rimLightHex",
              "propTheme",
              "ambientMotif",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      const fixHex = (val: unknown, fb: string) =>
        typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val.trim()) ? val.trim().toUpperCase() : fb;
      const safeTheme = allowedPropThemes.has(parsed.propTheme) ? parsed.propTheme : "minimal";
      const safeMotif = allowedMotifs.has(parsed.ambientMotif) ? parsed.ambientMotif : "motes";
      res.json({
        title: String(parsed.title || "Custom Surroundings").slice(0, 80),
        description: String(parsed.description || prompt).slice(0, 240),
        skyTopHex: fixHex(parsed.skyTopHex, "#1E293B"),
        skyBottomHex: fixHex(parsed.skyBottomHex, "#334155"),
        fogHex: fixHex(parsed.fogHex, "#283548"),
        keyLightHex: fixHex(parsed.keyLightHex, "#FFE4C4"),
        rimLightHex: fixHex(parsed.rimLightHex, "#93C5FD"),
        propTheme: safeTheme,
        ambientMotif: safeMotif,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate surroundings.";
      console.error("/api/kith/background error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 8. Audio / Voice Sample Analyzer (Tapes, CDs, Live Mic, Own Voice)
  app.post("/api/kith/voice-analyze", async (req: Request, res: Response) => {
    try {
      const { attachment, description = "", sourceKind = "recorded_media", identity = {} } = req.body ?? {};
      if (!attachment?.data && !String(description).trim()) {
        res.status(400).json({ error: "Provide an audio sample or vocal description to analyze." });
        return;
      }

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      if (attachment?.data && attachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: attachment.mimeType,
            data: attachment.data,
          },
        });
      }
      parts.push({
        text: `Analyze this ${sourceKind} voice reference${description ? ` and notes ("${String(description).slice(0, 200)}")` : ""} for companion "${identity?.primaryName || "Julian"}" (gender: ${identity?.gender || "masculine"}).
Pick the closest base cast voice from ['Charon', 'Puck', 'Fenrir', 'Zephyr', 'Aoede', 'Leda', 'Kore'] and write a vivid, concise TTS stylePrompt (under 180 chars) describing warmth, cadence, pace, and vocal character, plus a 1-sentence cadenceSummary and short transcriptPreview (if audible speech is present).`,
      });

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendedVoiceName: {
                type: Type.STRING,
                enum: ["Charon", "Puck", "Fenrir", "Zephyr", "Aoede", "Leda", "Kore"],
              },
              stylePrompt: { type: Type.STRING },
              cadenceSummary: { type: Type.STRING },
              transcriptPreview: { type: Type.STRING },
            },
            required: ["recommendedVoiceName", "stylePrompt", "cadenceSummary"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        recommendedVoiceName: parsed.recommendedVoiceName || "Charon",
        stylePrompt: String(parsed.stylePrompt || "Warm, steady, conversational cadence").slice(0, 240),
        cadenceSummary: String(parsed.cadenceSummary || "Matched vocal timbre and pacing.").slice(0, 240),
        transcriptPreview: parsed.transcriptPreview ? String(parsed.transcriptPreview).slice(0, 200) : "",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to analyze voice sample.";
      console.error("/api/kith/voice-analyze error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 9. Journal Reflection Helper
  app.post("/api/kith/journal-reflect", async (req: Request, res: Response) => {
    try {
      const { title, content, mood, identity = {}, ageTier = "teen", userName } = req.body ?? {};
      if (!content) {
        res.status(400).json({ error: "Write a journal thought first." });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = [
        buildCompanionSystemPrompt(identity, ageTier, userName),
        "Mode: Private Emotional Support Confidant. Offer heartfelt, observant, non-judgmental validation and one gentle grounding perspective.",
      ].join("\n\n");

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Journal Title: ${title || "Untitled"}\nMood: ${mood}\nEntry:\n${content}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reflection: { type: Type.STRING },
              gesture: {
                type: Type.STRING,
                enum: ["smirk", "wink", "laugh", "thumbs_up", "concerned_tilt", "warm_nod", "curious_brow", "gentle_smile"],
              },
            },
            required: ["reflection", "gesture"],
          },
        },
      });

      res.json(JSON.parse((response.text ?? "{}").trim()));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reflect on journal.";
      console.error("/api/kith/journal-reflect error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 10. Background Music Arrangement Generator
  app.post("/api/kith/music", async (req: Request, res: Response) => {
    try {
      const { prompt, identity = {} } = req.body ?? {};
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({ error: "Describe the music style, instruments, or vibe you want." });
        return;
      }

      const ai = getAiClient();
      const allowedGenres = new Set([
        "classic",
        "pop",
        "rap",
        "country",
        "electronic",
        "instrumental",
      ]);
      const allowedScales = new Set([
        "major",
        "minor",
        "dorian",
        "pentatonic_major",
        "pentatonic_minor",
      ]);
      const allowedLeads = new Set([
        "piano",
        "strings",
        "acoustic_guitar",
        "synth_pluck",
        "warm_pad",
        "flute",
      ]);
      const allowedBass = new Set([
        "none",
        "cello_drone",
        "sub_808",
        "synth_pulse",
        "country_root_fifth",
        "walking_bass",
      ]);
      const allowedDrums = new Set([
        "none",
        "boom_bap",
        "pop_groove",
        "country_brush",
        "electronic_pulse",
        "soft_ambient",
      ]);

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Compose an original looping background music arrangement for AI companion "${identity?.primaryName || "Julian"}" (setting: ${identity?.backgroundSpec?.title || "Studio"}).
User music request: "${prompt.trim().slice(0, 240)}"
Guidelines:
- genre: pick from 'classic' | 'pop' | 'rap' | 'country' | 'electronic' | 'instrumental'
- bpm: integer 55..140 matching the genre & mood (classic ~62-84, rap ~80-98, country ~72-96, pop ~104-126, electronic ~110-136, instrumental ~60-90)
- rootMidi: integer MIDI root 48..66 (e.g., 60 for C4, 55 for G3)
- scaleMode: 'major' | 'minor' | 'dorian' | 'pentatonic_major' | 'pentatonic_minor'
- chords: array of 4 integer scale degrees (0..6), e.g., [0, 5, 3, 4] or [0, 3, 4, 0]
- melody: array of exactly 16 integer scale-degree offsets (-1 for rest, 0..11 for note) creating a pleasant, non-repetitive, musical hook with breathing space (-1 rests)
- leadInstrument: 'piano' | 'strings' | 'acoustic_guitar' | 'synth_pluck' | 'warm_pad' | 'flute'
- bassStyle: 'none' | 'cello_drone' | 'sub_808' | 'synth_pulse' | 'country_root_fifth' | 'walking_bass'
- drumPattern: 'none' | 'boom_bap' | 'pop_groove' | 'country_brush' | 'electronic_pulse' | 'soft_ambient'
- brightness: integer 20..95 (warmth vs sparkle)
- swing: integer 0..30 (percent swing, 0 for classic/electronic, 10-24 for rap/country)`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              genre: {
                type: Type.STRING,
                enum: ["classic", "pop", "rap", "country", "electronic", "instrumental"],
              },
              bpm: { type: Type.INTEGER },
              rootMidi: { type: Type.INTEGER },
              scaleMode: {
                type: Type.STRING,
                enum: ["major", "minor", "dorian", "pentatonic_major", "pentatonic_minor"],
              },
              chords: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              melody: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              leadInstrument: {
                type: Type.STRING,
                enum: ["piano", "strings", "acoustic_guitar", "synth_pluck", "warm_pad", "flute"],
              },
              bassStyle: {
                type: Type.STRING,
                enum: ["none", "cello_drone", "sub_808", "synth_pulse", "country_root_fifth", "walking_bass"],
              },
              drumPattern: {
                type: Type.STRING,
                enum: ["none", "boom_bap", "pop_groove", "country_brush", "electronic_pulse", "soft_ambient"],
              },
              brightness: { type: Type.INTEGER },
              swing: { type: Type.INTEGER },
            },
            required: [
              "title",
              "description",
              "genre",
              "bpm",
              "rootMidi",
              "scaleMode",
              "chords",
              "melody",
              "leadInstrument",
              "bassStyle",
              "drumPattern",
              "brightness",
              "swing",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      const cleanChords = Array.isArray(parsed.chords)
        ? parsed.chords
            .map((c: unknown) => Math.max(0, Math.min(6, Math.round(Number(c) || 0))))
            .slice(0, 8)
        : [0, 3, 4, 0];
      const cleanMelody = Array.isArray(parsed.melody)
        ? parsed.melody
            .map((m: unknown) =>
              Math.max(-1, Math.min(14, Math.round(Number.isFinite(Number(m)) ? Number(m) : -1)))
            )
            .slice(0, 32)
        : [0, 2, 4, -1, 5, 4, 2, -1, 0, 2, 4, 7, 5, 4, 2, -1];

      res.json({
        title: String(parsed.title || "Custom Companion Score").slice(0, 80),
        description: String(parsed.description || prompt).slice(0, 240),
        genre: allowedGenres.has(parsed.genre) ? parsed.genre : "instrumental",
        bpm: Math.max(45, Math.min(170, Math.round(Number(parsed.bpm) || 84))),
        rootMidi: Math.max(45, Math.min(72, Math.round(Number(parsed.rootMidi) || 60))),
        scaleMode: allowedScales.has(parsed.scaleMode) ? parsed.scaleMode : "minor",
        chords: cleanChords.length > 0 ? cleanChords : [0, 3, 4, 0],
        melody: cleanMelody.length > 0 ? cleanMelody : [0, 2, 4, -1, 5, 4, 2, -1],
        leadInstrument: allowedLeads.has(parsed.leadInstrument) ? parsed.leadInstrument : "piano",
        bassStyle: allowedBass.has(parsed.bassStyle) ? parsed.bassStyle : "cello_drone",
        drumPattern: allowedDrums.has(parsed.drumPattern) ? parsed.drumPattern : "soft_ambient",
        brightness: Math.max(10, Math.min(100, Math.round(Number(parsed.brightness) || 60))),
        swing: Math.max(0, Math.min(40, Math.round(Number(parsed.swing) || 0))),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate background music.";
      console.error("/api/kith/music error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 11. Cross-Session Memory Summarization & Fact Extraction
  app.post("/api/kith/summarize", async (req: Request, res: Response) => {
    try {
      const { messages = [], identity = {}, personaLabel = "Ally" } = req.body ?? {};
      if (!Array.isArray(messages) || messages.length < 2) {
        res.status(400).json({ error: "At least 2 messages are required to summarize a session." });
        return;
      }

      const transcript = messages
        .slice(-24)
        .map((m: { role?: string; text?: string }) => {
          const speaker = m.role === "user" ? "User" : identity?.primaryName || "Companion";
          return `${speaker}: ${String(m.text || "").trim().slice(0, 400)}`;
        })
        .join("\n");

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `You are summarizing a conversation between a user and their AI companion ("${personaLabel}").
Produce a specific, compact JSON summary:
- summary: 1-3 sentences capturing what mattered and where things landed (keep under 80 words; never generic).
- topics: 1-4 concise topic tags (e.g., career, learning, relationships, health, creative, daily).
- emotionalTone: brief arc like "anxious -> calmer" or "curious -> focused".
- openLoops: up to 2 concrete follow-ups worth checking in on later (empty array if none).
- newFacts: array of { type: 'goal'|'worry'|'preference'|'person'|'project', value: string } — ONLY facts the user explicitly stated, never inferred or guessed.
- isTrivial: boolean (true only if the session was pure small talk with zero memorable facts or open loops).

Conversation:
${transcript}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              topics: { type: Type.ARRAY, items: { type: Type.STRING } },
              emotionalTone: { type: Type.STRING },
              openLoops: { type: Type.ARRAY, items: { type: Type.STRING } },
              newFacts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    type: {
                      type: Type.STRING,
                      enum: ["goal", "worry", "preference", "person", "project"],
                    },
                    value: { type: Type.STRING },
                  },
                  required: ["type", "value"],
                },
              },
              isTrivial: { type: Type.BOOLEAN },
            },
            required: [
              "summary",
              "topics",
              "emotionalTone",
              "openLoops",
              "newFacts",
              "isTrivial",
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        summary: String(parsed.summary || "").slice(0, 420),
        topics: Array.isArray(parsed.topics)
          ? parsed.topics.map((t: unknown) => String(t).slice(0, 32)).slice(0, 4)
          : ["daily"],
        emotionalTone: String(parsed.emotionalTone || "steady").slice(0, 60),
        openLoops: Array.isArray(parsed.openLoops)
          ? parsed.openLoops.map((l: unknown) => String(l).slice(0, 140)).slice(0, 2)
          : [],
        newFacts: Array.isArray(parsed.newFacts) ? parsed.newFacts.slice(0, 6) : [],
        isTrivial: Boolean(parsed.isTrivial),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to summarize session.";
      console.error("/api/kith/summarize error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 12. Proactive Presence Check-In Generator
  app.post("/api/kith/proactive", async (req: Request, res: Response) => {
    try {
      const {
        triggerId,
        triggerContext,
        identity = {},
        ageTier = "teen",
        userName,
        memoryContext = "",
      } = req.body ?? {};
      if (!triggerId || !triggerContext) {
        res.status(400).json({ error: "triggerId and triggerContext are required." });
        return;
      }

      const ai = getAiClient();
      const systemInstruction = buildCompanionSystemPrompt(identity, ageTier, userName);
      const prompt = `The user has opened the app without starting a message yet. You are initiating ONE brief, genuine check-in in your active persona.

Trigger type: ${String(triggerId).slice(0, 40)}
Trigger context: ${String(triggerContext).slice(0, 240)}
${memoryContext ? `Additional background:\n${String(memoryContext).slice(0, 900)}` : ""}

Rules (strict):
- Write 1-2 sentences max in your active persona voice.
- Be specific to the trigger context (never generic "hope you're well").
- Be gentle, never urgent or demanding.
- NEVER say "I noticed", "I remembered", "my memory", or "our last conversation" — speak naturally as if picking up a thread between friends.
- If the context feels uncertain, ask a light question rather than assuming.`;

      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              message: { type: Type.STRING },
              gesture: {
                type: Type.STRING,
                enum: [
                  "smirk",
                  "wink",
                  "laugh",
                  "thumbs_up",
                  "concerned_tilt",
                  "warm_nod",
                  "curious_brow",
                  "gentle_smile",
                ],
              },
              voiceTone: {
                type: Type.STRING,
                enum: ["warm", "excited", "calm", "witty"],
              },
            },
            required: ["message", "gesture", "voiceTone"],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? "{}").trim());
      res.json({
        message: String(parsed.message || "").slice(0, 320),
        gesture: parsed.gesture || "warm_nod",
        voiceTone: parsed.voiceTone || identity?.voiceTone || "warm",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate check-in.";
      console.error("/api/kith/proactive error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // 13. AI Portrait Mode Generator (Imagen 3)
  app.post("/api/kith/portrait", async (req: Request, res: Response) => {
    try {
      const { identity = {}, style = "painterly" } = req.body ?? {};
      const ai = getAiClient();

      const archetypeStyleMap: Record<string, string> = {
        goth_academia: "gothic dark academia portrait, moody lighting, violet eyes, dark flowing hair, high-collar black trench coat",
        classic_scholar: "classic scholar portrait, warm golden lighting, amber eyes, chestnut hair, academic blazer, silver-rimmed glasses",
        sporty_vanguard: "modern athletic portrait, clean cool lighting, athletic jacket, dynamic confident energy",
        arcane_fantasy: "fantasy archivist portrait, emerald ambient lighting, brass astrolabe pin, draped mantle",
        retro_analog: "retro analog portrait, warm golden-hour lighting, ochre corduroy jacket, vintage vinyl aesthetic",
      };

      const decadeMap: Record<number, string> = {
        0: "young child",
        1: "teenager",
        2: "young adult",
        3: "adult in their thirties",
        4: "adult in their forties",
        5: "adult in their fifties",
        6: "elderly person",
      };

      const styleMap: Record<string, string> = {
        painterly: "oil painting, artistic brush strokes, fine art portrait",
        photorealistic: "ultra-realistic portrait photography, 8k, professional studio lighting",
        cinematic: "cinematic film still, dramatic lighting, anamorphic bokeh",
        anime: "high quality Japanese anime character design, crisp lines, beautiful shading",
      };

      const archKey = identity?.archetype || "classic_scholar";
      const archPrompt = archetypeStyleMap[archKey] || archetypeStyleMap.classic_scholar;
      const decadeNum = Number(identity?.decadeStage ?? 0);
      const decadeStr = decadeMap[decadeNum] || "young adult";
      const stylePrompt = styleMap[style] || styleMap.painterly;
      const genderStr = identity?.gender || "masculine";
      const nameStr = identity?.primaryName || "Julian";

      const fullPrompt = `Character portrait of ${nameStr}, a ${genderStr} companion. ${archPrompt}, ${decadeStr}, ${stylePrompt}, highly detailed, masterpiece, beautiful composition, soft studio lighting.`;

      const response = await ai.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: "image/jpeg",
          aspectRatio: "3:4",
        },
      });

      const base64Bytes = response.generatedImages?.[0]?.image?.imageBytes;
      if (!base64Bytes) {
        throw new Error("Imagen returned no image data.");
      }

      const imageUrl = `data:image/jpeg;base64,${base64Bytes}`;
      res.json({ imageUrl });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate portrait.";
      console.error("/api/kith/portrait error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kith Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Kith Studio server:", err);
  process.exit(1);
});
