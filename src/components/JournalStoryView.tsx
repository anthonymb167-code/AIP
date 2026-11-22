import { useState } from "react";
import { Feather, Compass, Image as ImageIcon, Trash2, Volume2, BookMarked } from "lucide-react";
import type {
  AgeTier,
  CompanionIdentity,
  JournalEntry,
  StoryBeat,
  StoryRecord,
} from "../types/kith";
import { LiveRigSvg } from "./CompanionStageAvatar";
import { getVoiceSampleKey } from "../lib/audioStore";
import { speakCompanionLine } from "../lib/voice";

interface JournalStoryViewProps {
  identity: CompanionIdentity;
  userId?: string | null;
  ageTier: AgeTier;
  userName: string;
  offlineMode: boolean;
  journals: JournalEntry[];
  stories: StoryRecord[];
  onSaveJournal: (entry: JournalEntry) => void;
  onDeleteJournal: (id: string) => void;
  onSaveStory: (story: StoryRecord) => void;
  onLogActivity: (summary: string, mode: "journal" | "storytime") => void;
}

const MOODS = ["Reflective", "Calm", "Hopeful", "Overwhelmed", "Grateful", "Determined"];
const STORY_SEEDS = [
  "You and your companion discover a hidden library beneath an old clocktower",
  "A rain-washed midnight train where every passenger carries an unfinished book",
  "An observatory greenhouse charting constellations no map has named yet",
];

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function JournalStoryView({
  identity,
  userId,
  ageTier,
  userName,
  offlineMode,
  journals,
  stories,
  onSaveJournal,
  onDeleteJournal,
  onSaveStory,
  onLogActivity,
}: JournalStoryViewProps) {
  const [subMode, setSubMode] = useState<"journal" | "story">("journal");
  const callName = identity.activeNickname || "friend";

  // Journal state
  const [title, setTitle] = useState("");
  const [mood, setMood] = useState(MOODS[0]);
  const [content, setContent] = useState("");
  const [artPrompt, setArtPrompt] = useState("");
  const [generatedArt, setGeneratedArt] = useState<{
    title: string;
    caption: string;
    svgMarkup: string;
  } | null>(null);
  const [journalBusy, setJournalBusy] = useState(false);
  const [artBusy, setArtBusy] = useState(false);
  const [journalError, setJournalError] = useState<string | null>(null);

  // Storytime state
  const [storyTheme, setStoryTheme] = useState(STORY_SEEDS[0]);
  const [beats, setBeats] = useState<StoryBeat[]>([]);
  const [storyBusy, setStoryBusy] = useState(false);
  const [storyError, setStoryError] = useState<string | null>(null);
  const [storyArtSvg, setStoryArtSvg] = useState<string | null>(null);

  async function handleIllustrate(promptText: string, forStory = false) {
    if (!promptText.trim()) return;
    setArtBusy(true);
    setJournalError(null);
    try {
      const res = await fetch("/api/kith/art", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, mood, identity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not illustrate scene.");
      if (forStory) {
        setStoryArtSvg(data.svgMarkup);
      } else {
        setGeneratedArt(data);
      }
    } catch (err) {
      setJournalError(err instanceof Error ? err.message : "Illustration error.");
    } finally {
      setArtBusy(false);
    }
  }

  async function handleReflectAndSave() {
    if (!content.trim()) return;
    setJournalBusy(true);
    setJournalError(null);
    let reflection = `I hear you, ${callName}. Thank you for trusting ${identity.primaryName} with this—take a breath, and know I'm right in your corner.`;

    if (!offlineMode) {
      try {
        const res = await fetch("/api/kith/journal-reflect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, mood, identity, ageTier, userName }),
        });
        const data = await res.json();
        if (res.ok && data.reflection) {
          reflection = data.reflection;
        }
      } catch {
        // Keep reassuring offline reflection
      }
    }

    const entry: JournalEntry = {
      id: `j_${Date.now()}`,
      title: title.trim() || `${mood} Reflection`,
      content: content.trim(),
      mood,
      companionReflection: reflection,
      artSvg: generatedArt?.svgMarkup,
      artCaption: generatedArt?.caption,
      createdAtIso: new Date().toISOString(),
    };
    onSaveJournal(entry);
    onLogActivity(`Journaled "${entry.title}"`, "journal");
    setTitle("");
    setContent("");
    setArtPrompt("");
    setGeneratedArt(null);
    setJournalBusy(false);
  }

  async function handleStartOrAdvanceStory(chosenOption?: string) {
    setStoryBusy(true);
    setStoryError(null);
    try {
      const res = await fetch("/api/kith/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: storyTheme,
          previousBeats: beats,
          chosenOption,
          identity,
          ageTier,
          userName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not continue story.");
      const updatedBeats =
        chosenOption && beats.length > 0
          ? [
              ...beats.slice(0, -1),
              { ...beats[beats.length - 1], chosenLabel: chosenOption },
              data,
            ]
          : [data];
      setBeats(updatedBeats);
      onLogActivity(`Explored story: ${data.chapterTitle}`, "storytime");
    } catch (err) {
      setStoryError(err instanceof Error ? err.message : "Storytime error.");
    } finally {
      setStoryBusy(false);
    }
  }

  function handleSaveCurrentStory() {
    if (beats.length === 0) return;
    const summary = beats
      .map((b, i) => `Ch. ${i + 1} (${b.chapterTitle}): ${b.narrative}`)
      .join("\n\n")
      .slice(0, 3900);
    onSaveStory({
      id: `s_${Date.now()}`,
      title: beats[0].chapterTitle,
      theme: storyTheme,
      summary,
      createdAtIso: new Date().toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      {/* Sub-mode Segmented Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-ink">
            {subMode === "journal"
              ? "Emotional Support Journal & Illustrated Memories"
              : "Interactive Storytime & Roleplay"}
          </h2>
          <p className="text-sm text-ink-muted">
            {subMode === "journal"
              ? `A private space where ${identity.primaryName} listens without judgment and illustrates memories with you.`
              : `Co-author branching adventures where you are the main character alongside ${identity.primaryName}.`}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-xl">
          <button
            type="button"
            onClick={() => setSubMode("journal")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              subMode === "journal"
                ? "bg-surface text-ink ring-1 ring-edge"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Feather className="w-3.5 h-3.5" />
            Journal &amp; Art
          </button>
          <button
            type="button"
            onClick={() => setSubMode("story")}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              subMode === "story"
                ? "bg-surface text-ink ring-1 ring-edge"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Storytime
          </button>
        </div>
      </div>

      {subMode === "journal" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Journal Composer */}
          <div className="lg:col-span-6 bg-surface border border-edge rounded-2xl p-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="j-title" className="text-xs font-medium text-ink-secondary">
                Entry Title
              </label>
              <input
                id="j-title"
                type="text"
                maxLength={140}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's on your mind today?"
                className="w-full px-3.5 py-2 text-sm bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-ink-secondary">Current Mood</div>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-lg border cursor-pointer transition-colors ${
                      mood === m
                        ? "bg-accent text-accent-fg border-accent"
                        : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="j-content" className="text-xs font-medium text-ink-secondary">
                Your Thoughts
              </label>
              <textarea
                id="j-content"
                rows={5}
                maxLength={6000}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Write freely—${identity.primaryName} keeps everything private and backs you up completely.`}
                className="w-full px-3.5 py-2.5 text-sm bg-surface-alt border border-edge rounded-xl text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Scene / Feeling Art Generator */}
            <div className="p-4 rounded-xl bg-surface-alt border border-edge space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">
                  Illustrate Scene or Feeling
                </span>
                <ImageIcon className="w-4 h-4 text-accent-ink" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={artPrompt}
                  onChange={(e) => setArtPrompt(e.target.value)}
                  placeholder="Describe a scene or feeling to paint..."
                  className="flex-1 min-w-0 px-3 py-1.5 text-xs bg-surface border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="button"
                  disabled={artBusy || offlineMode || (!artPrompt.trim() && !content.trim())}
                  onClick={() => handleIllustrate(artPrompt.trim() || content.trim())}
                  className="px-3 py-1.5 text-xs font-medium text-accent-ink bg-surface border border-edge rounded-lg hover:border-accent disabled:opacity-50 cursor-pointer whitespace-nowrap"
                >
                  {artBusy ? "Painting..." : "Create Visual"}
                </button>
              </div>
              {generatedArt && (
                <div className="space-y-1.5 pt-2">
                  <img
                    src={svgToDataUrl(generatedArt.svgMarkup)}
                    alt={generatedArt.title}
                    className="w-full h-44 object-cover rounded-lg border border-edge"
                  />
                  <div className="text-xs text-ink-muted">
                    <span className="font-medium text-ink">{generatedArt.title}:</span>{" "}
                    {generatedArt.caption}
                  </div>
                </div>
              )}
            </div>

            {journalError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
                {journalError}
              </div>
            )}

            <button
              type="button"
              disabled={journalBusy || !content.trim()}
              onClick={handleReflectAndSave}
              className="w-full py-2.5 px-4 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
            >
              {journalBusy ? "Saving & Reflecting..." : "Reflect & Save Entry"}
            </button>
          </div>

          {/* Saved Journal Feed */}
          <div className="lg:col-span-6 space-y-4">
            <h3 className="text-base font-semibold text-ink">
              Saved Reflections &amp; Visual Memories ({journals.length})
            </h3>
            {journals.length === 0 ? (
              <div className="bg-surface border border-edge rounded-2xl p-8 text-center space-y-2">
                <p className="text-sm font-medium text-ink">
                  Your journal shelf is waiting
                </p>
                <p className="text-xs text-ink-muted">
                  Write your first entry or illustrate a mood to save it here privately.
                </p>
              </div>
            ) : (
              journals.map((entry) => (
                <article
                  key={entry.id}
                  className="bg-surface border border-edge rounded-2xl p-5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs text-ink-muted flex items-center gap-2">
                        <span>{entry.mood}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular">
                          {new Date(entry.createdAtIso).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-ink mt-0.5">
                        {entry.title}
                      </h4>
                    </div>
                    <button
                      type="button"
                      aria-label={`Delete ${entry.title}`}
                      onClick={() => onDeleteJournal(entry.id)}
                      className="p-1.5 text-ink-muted hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">
                    {entry.content}
                  </p>

                  {entry.artSvg && (
                    <div className="space-y-1">
                      <img
                        src={svgToDataUrl(entry.artSvg)}
                        alt={entry.artCaption || entry.title}
                        className="w-full h-44 object-cover rounded-xl border border-edge"
                      />
                      {entry.artCaption && (
                        <p className="text-xs text-ink-muted">{entry.artCaption}</p>
                      )}
                    </div>
                  )}

                  {entry.companionReflection && (
                    <div className="p-3.5 rounded-xl bg-surface-alt border border-edge text-xs text-ink-secondary leading-relaxed">
                      <span className="font-semibold text-accent-ink">
                        {identity.primaryName}:
                      </span>{" "}
                      {entry.companionReflection}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      ) : (
        /* Interactive Storytime & Roleplay */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-4 space-y-5">
            <div className="bg-surface border border-edge rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-semibold text-ink">
                Choose Adventure Setting
              </h3>
              <div className="space-y-2">
                {STORY_SEEDS.map((seed) => (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => setStoryTheme(seed)}
                    className={`w-full text-left p-3 rounded-xl border text-xs leading-relaxed cursor-pointer transition-colors ${
                      storyTheme === seed
                        ? "bg-accent-soft border-accent text-ink font-medium"
                        : "bg-surface-alt border-edge text-ink-muted hover:border-edge-strong"
                    }`}
                  >
                    {seed}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={storyTheme}
                onChange={(e) => setStoryTheme(e.target.value)}
                placeholder="Or write your own opening premise..."
                className="w-full px-3 py-2 text-xs bg-surface-alt border border-edge rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <button
                type="button"
                disabled={storyBusy || offlineMode}
                onClick={() => handleStartOrAdvanceStory()}
                className="w-full py-2.5 px-4 text-sm font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 cursor-pointer"
              >
                {storyBusy ? "Opening Chapter..." : "Start New Adventure"}
              </button>
            </div>

            {stories.length > 0 && (
              <div className="bg-surface border border-edge rounded-2xl p-5 space-y-3">
                <h4 className="text-sm font-semibold text-ink">
                  Saved Stories ({stories.length})
                </h4>
                <div className="space-y-2">
                  {stories.slice(0, 5).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg bg-surface-alt border border-edge text-xs"
                    >
                      <div className="font-semibold text-ink">{s.title}</div>
                      <div className="text-ink-muted line-clamp-2 mt-0.5">{s.summary}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 bg-surface border border-edge rounded-2xl p-6 space-y-6">
            {beats.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-32 mx-auto rounded-2xl bg-[#090D16] border border-[#1E293B] p-2.5">
                  <LiveRigSvg identity={identity} gesture="smirk" />
                </div>
                <h3 className="text-lg font-semibold text-ink">
                  Ready to step into the story, {callName}?
                </h3>
                <p className="text-sm text-ink-muted max-w-md mx-auto">
                  Pick a premise on the left and {identity.primaryName} will set the opening scene with you as the protagonist.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {storyArtSvg && (
                  <img
                    src={svgToDataUrl(storyArtSvg)}
                    alt="Illustrated story scene"
                    className="w-full h-56 object-cover rounded-xl border border-edge"
                  />
                )}

                {beats.map((beat, idx) => (
                  <div
                    key={idx}
                    className="space-y-3 pb-5 border-b border-edge last:border-b-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-mono-tabular text-accent-ink font-medium">
                        Chapter 0{idx + 1} · {beat.chapterTitle}
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
                              beat.narrative,
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
                                pitch: identity.voicePitch,
                              }
                            );
                          }}
                          className="inline-flex items-center gap-1 text-xs text-accent-ink hover:underline cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          Narrate
                        </button>
                      )}
                    </div>
                    <p className="text-[15px] text-ink leading-relaxed whitespace-pre-wrap">
                      {beat.narrative}
                    </p>
                    <div className="p-3 rounded-xl bg-surface-alt border border-edge text-xs text-ink-secondary">
                      <span className="font-semibold text-accent-ink">
                        {identity.primaryName}:
                      </span>{" "}
                      “{beat.companionAside}”
                    </div>
                    {beat.chosenLabel && (
                      <div className="text-xs font-medium text-ink-muted">
                        Chosen path: {beat.chosenLabel}
                      </div>
                    )}
                  </div>
                ))}

                {/* Current Choices */}
                {beats[beats.length - 1]?.choices?.length > 0 && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-ink">
                      What do you and {identity.primaryName} do next?
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {beats[beats.length - 1].choices.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={storyBusy}
                          onClick={() => handleStartOrAdvanceStory(c.label)}
                          className="p-3 text-left rounded-xl border border-edge bg-surface-alt hover:border-accent hover:bg-accent-soft transition-colors cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-ink">
                            {c.label}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-0.5">
                            {c.tone}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    disabled={artBusy || offlineMode}
                    onClick={() =>
                      handleIllustrate(beats[beats.length - 1].narrative, true)
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-accent-ink bg-accent-soft rounded-lg hover:bg-surface-hover cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    {artBusy ? "Illustrating..." : "Illustrate Scene"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveCurrentStory}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-accent-fg bg-accent rounded-lg hover:bg-accent-hover cursor-pointer"
                  >
                    <BookMarked className="w-3.5 h-3.5" />
                    Save Story
                  </button>
                </div>
              </div>
            )}

            {storyError && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
                {storyError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
