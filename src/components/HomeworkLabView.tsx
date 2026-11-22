import { useEffect, useState, type ChangeEvent } from "react";
import { BookOpen, Briefcase, Cpu, Film, Puzzle, Stethoscope, Upload, Volume2, ArrowRight, Wrench } from "lucide-react";
import {
  INDUSTRIES,
  type AgeTier,
  type CompanionIdentity,
  type GestureId,
  type IndustryId,
} from "../types/kith";
import { LiveRigSvg } from "./CompanionStageAvatar";
import { getVoiceSampleKey } from "../lib/audioStore";
import { speakCompanionLine } from "../lib/voice";

interface HomeworkStep {
  title: string;
  explanation: string;
  checkQuestion: string;
}

interface HomeworkResult {
  encouragement: string;
  conceptSummary: string;
  steps: HomeworkStep[];
  literaryOrRealWorldTieIn: string;
  gesture: GestureId;
}

interface HomeworkLabViewProps {
  identity: CompanionIdentity;
  userId?: string | null;
  ageTier: AgeTier;
  userName: string;
  offlineMode: boolean;
  initialModuleId?: string | null;
  onLogActivity: (summary: string) => void;
}

const SCHOOL_SUBJECTS = [
  "Literature & Essays",
  "History & Humanities",
  "Math & Logic",
  "Sciences",
];

function getIndustryIcon(industryId: IndustryId) {
  switch (industryId) {
    case "SCHOOL":
      return BookOpen;
    case "MEDICAL":
      return Stethoscope;
    case "TECH":
      return Cpu;
    case "CREATIVE":
      return Film;
    case "BUSINESS":
      return Briefcase;
    case "TRADES":
      return Wrench;
    default:
      return Puzzle;
  }
}

export function HomeworkLabView({
  identity,
  userId,
  ageTier,
  userName,
  offlineMode,
  initialModuleId,
  onLogActivity,
}: HomeworkLabViewProps) {
  const industryId: IndustryId = identity.selectedIndustry || "NONE";
  const industry = INDUSTRIES[industryId] || INDUSTRIES.NONE;
  const enabledIds = identity.enabledIndustryModules || [];
  const activeModules = industry.modules.filter((m) => enabledIds.includes(m.id));

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    () => initialModuleId || activeModules[0]?.id || ""
  );
  const [schoolSubject, setSchoolSubject] = useState(SCHOOL_SUBJECTS[0]);
  const [question, setQuestion] = useState("");
  const [attachment, setAttachment] = useState<{
    data: string;
    mimeType: string;
    fileName: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HomeworkResult | null>(null);

  useEffect(() => {
    if (initialModuleId && enabledIds.includes(initialModuleId)) {
      setSelectedModuleId(initialModuleId);
    } else if (!enabledIds.includes(selectedModuleId)) {
      setSelectedModuleId(activeModules[0]?.id || "");
    }
    setResult(null);
  }, [industryId, initialModuleId, enabledIds, activeModules, selectedModuleId]);

  const activeModule =
    activeModules.find((m) => m.id === selectedModuleId) || activeModules[0];
  const IndustryIcon = getIndustryIcon(industryId);
  const isSchool = industryId === "SCHOOL";

  function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || "");
      const base64 = str.includes(",") ? str.split(",")[1] : str;
      setAttachment({
        data: base64,
        mimeType: file.type || "application/pdf",
        fileName: file.name,
      });
    };
    reader.readAsDataURL(file);
  }

  async function handleAnalyze() {
    if (!question.trim() && !attachment) return;
    setBusy(true);
    setError(null);
    const focusLabel = isSchool
      ? schoolSubject
      : activeModule?.label || industry.label;
    try {
      const res = await fetch("/api/kith/homework", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          subject: focusLabel,
          industryId:
            industryId === "OTHER" && identity.otherIndustryName
              ? identity.otherIndustryName
              : industry.label,
          moduleLabel: activeModule?.label || industry.shortDeskLabel,
          identity,
          ageTier,
          userName,
          attachment: attachment
            ? { data: attachment.data, mimeType: attachment.mimeType }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to analyze this task right now.");
      }
      setResult(data);
      onLogActivity(
        `${activeModule?.label || industry.shortDeskLabel} session with ${identity.primaryName}`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not connect for workspace analysis."
      );
    } finally {
      setBusy(false);
    }
  }

  const workspaceTitle =
    industryId === "OTHER" && identity.otherIndustryName?.trim()
      ? `${identity.otherIndustryName.trim()} Workspace`
      : isSchool
      ? "Learning & Study Lab"
      : `${industry.label} Workspace`;

  const workspacePlaceholder = isSchool
    ? "Paste a passage, essay prompt, or describe where you're stuck on an assignment..."
    : industryId === "MEDICAL"
    ? "Paste shift handoff notes, protocol steps to verify, or a patient update to draft clearly..."
    : industryId === "TECH"
    ? "Paste a stack trace, module architecture question, or code snippet to review together..."
    : industryId === "CREATIVE"
    ? "Share a script beat, rough draft, or creative angle you want to sharpen..."
    : industryId === "BUSINESS"
    ? "Describe a decision trade-off, executive memo outline, or negotiation scenario..."
    : industryId === "TRADES"
    ? "Outline the job sequence, materials checklist, or pre-task safety inspection..."
    : "Describe the task, workflow, or document you want to tackle step by step...";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Input */}
      <div className="lg:col-span-5 bg-surface border border-edge rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {workspaceTitle}
            </h2>
            <p className="text-xs text-ink-muted mt-1">
              {industry.tagline} {identity.primaryName} walks through it step-by-step with clarity.
            </p>
          </div>
          <IndustryIcon className="w-5 h-5 text-accent-ink shrink-0" />
        </div>

        {/* Active Industry Module Selector */}
        {activeModules.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-ink-secondary">
              Enabled {industry.shortDeskLabel} Modules
            </div>
            <div className="flex flex-wrap gap-2">
              {activeModules.map((mod) => (
                <button
                  key={mod.id}
                  type="button"
                  onClick={() => setSelectedModuleId(mod.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    selectedModuleId === mod.id
                      ? "bg-accent text-accent-fg border-accent"
                      : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                  }`}
                >
                  {mod.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* School subject focus only shown when School industry is active */}
        {isSchool && (
          <div className="space-y-2">
            <div className="text-xs font-medium text-ink-secondary">Subject Focus</div>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_SUBJECTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSchoolSubject(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    schoolSubject === s
                      ? "bg-accent text-accent-fg border-accent"
                      : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label
            htmlFor="industry-workspace-input"
            className="block text-xs font-medium text-ink-secondary"
          >
            {activeModule ? `${activeModule.label} Input` : "Task, Draft, or File"}
          </label>
          <textarea
            id="industry-workspace-input"
            rows={5}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={workspacePlaceholder}
            className="w-full px-3.5 py-2.5 text-sm bg-surface-alt border border-edge rounded-xl text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-ink-secondary bg-surface-alt border border-edge rounded-lg hover:border-edge-strong cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span className="truncate max-w-[180px]">
              {attachment ? attachment.fileName : "Upload Photo or PDF"}
            </span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={handleUpload}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            disabled={busy || offlineMode || (!question.trim() && !attachment)}
            onClick={handleAnalyze}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{busy ? "Working through it..." : "Walk Me Through"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {offlineMode && (
          <p className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            Offline Mode is active. Switch back to Online to analyze uploaded PDFs and documents.
          </p>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
      </div>

      {/* Right Step-by-Step Guide */}
      <div className="lg:col-span-7 space-y-6">
        {!result ? (
          <div className="bg-surface border border-edge rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6">
            <div className="w-36 shrink-0 rounded-2xl bg-[#090D16] border border-[#1E293B] p-2">
              <LiveRigSvg identity={identity} gesture="warm_nod" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-ink">
                Ready in {activeModule?.label || industry.shortDeskLabel}, {identity.activeNickname || "friend"}.
              </h3>
              <p className="text-sm text-ink-muted leading-relaxed">
                {activeModule
                  ? `${activeModule.desc}. Share any notes, files, or questions and ${identity.primaryName} will break it into clear, practical steps.`
                  : `${identity.primaryName} breaks down your tasks step-by-step without judgment or noise.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-edge rounded-2xl p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-edge">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 shrink-0 rounded-full overflow-hidden bg-[#090D16] border border-[#1E293B]">
                  <LiveRigSvg identity={identity} gesture={result.gesture || "thumbs_up"} compact />
                </div>
                <div>
                  <div className="text-xs font-medium text-accent-ink">
                    {activeModule?.label || industry.shortDeskLabel} · {identity.primaryName}
                  </div>
                  <p className="text-sm font-medium text-ink mt-0.5">
                    {result.encouragement}
                  </p>
                </div>
              </div>
              {identity.voiceSource !== "silent" && (
                <button
                  type="button"
                  onClick={() => {
                    const sampleKind =
                      identity.voiceSource === "recorded_media" ||
                      identity.voiceSource === "live_mic" ||
                      identity.voiceSource === "own_voice"
                        ? identity.voiceSource
                        : null;
                    void speakCompanionLine(
                      `${result.encouragement} ${result.conceptSummary}`,
                      identity.voiceTone,
                      offlineMode,
                      undefined,
                      undefined,
                      undefined,
                      identity.gender,
                      {
                        voiceSource: identity.voiceSource,
                        voicePresetId: identity.voicePresetId,
                        voiceStylePrompt: identity.voiceStylePrompt,
                        voiceExternalUrl: identity.voiceExternalUrl,
                        sampleKey: sampleKind
                          ? getVoiceSampleKey(sampleKind, userId)
                          : undefined,
                      }
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  Listen
                </button>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">
                Core Summary
              </h3>
              <p className="text-sm text-ink-secondary leading-relaxed">
                {result.conceptSummary}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-ink">
                Step-by-Step Breakdown
              </h3>
              <div className="space-y-3">
                {result.steps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-surface-alt border border-edge space-y-1.5"
                  >
                    <div className="text-xs font-semibold text-accent-ink">
                      Step 0{idx + 1}. {step.title}
                    </div>
                    <p className="text-sm text-ink leading-relaxed">
                      {step.explanation}
                    </p>
                    <p className="text-xs text-ink-muted pt-1">
                      <span className="font-medium text-ink">Check together:</span>{" "}
                      {step.checkQuestion}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-accent-soft border border-edge text-sm text-ink leading-relaxed">
              <span className="font-semibold text-accent-ink">
                Practical &amp; Real-World Takeaway:
              </span>{" "}
              {result.literaryOrRealWorldTieIn}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
