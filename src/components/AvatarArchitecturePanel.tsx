import { useState } from "react";
import { Layers, SlidersHorizontal, Play } from "lucide-react";
import {
  ARCHETYPES,
  estimateAvatarDnaBytes,
  FACIAL_RIG_STATES,
  RENDER_ARCHITECTURE_COMPARISON,
  type CompanionIdentity,
  type GestureId,
} from "../types/kith";
import type { StageViewMode } from "./CompanionStageAvatar";

interface AvatarArchitecturePanelProps {
  identity: CompanionIdentity;
  activeGesture: GestureId;
  activeViewMode: StageViewMode;
  onSelectGesture: (gesture: GestureId) => void;
  onSelectViewMode: (mode: StageViewMode) => void;
}

export function AvatarArchitecturePanel({
  identity,
  activeGesture,
  activeViewMode,
  onSelectGesture,
  onSelectViewMode,
}: AvatarArchitecturePanelProps) {
  const [panelTab, setPanelTab] = useState<"comparison" | "rig_matrix">("comparison");
  const arch = ARCHETYPES[identity.archetype];
  const studioLabel = identity.studioName?.trim() || "Kith Studios";
  const dnaBytes = estimateAvatarDnaBytes(identity);
  const billionTotalTb = ((dnaBytes * 1_000_000_000) / 1_000_000_000_000).toFixed(2);

  return (
    <section className="bg-surface border border-edge rounded-2xl p-6 space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-edge">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-ink [text-wrap:balance]">
            Stylized vs. Photorealistic 3D &amp; Facial Rig Architecture
          </h2>
          <p className="text-xs text-ink-muted">
            Evaluating billion-avatar scale &amp; repeated re-edits for{" "}
            <span className="font-medium text-ink">{studioLabel}</span> ·{" "}
            <span className="font-medium text-ink">{identity.primaryName}</span> ({arch.shortLabel})
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setPanelTab("comparison")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              panelTab === "comparison"
                ? "bg-surface text-ink ring-1 ring-edge"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Stylized vs. Photorealistic (1B+ Scale)
          </button>
          <button
            type="button"
            onClick={() => setPanelTab("rig_matrix")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              panelTab === "rig_matrix"
                ? "bg-surface text-ink ring-1 ring-edge"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Facial Rig &amp; Expression States (8)
          </button>
        </div>
      </div>

      {panelTab === "comparison" ? (
        <div className="space-y-6">
          {/* Live Billion-Scale DNA Readout Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pb-5 border-b border-edge">
            <div className="space-y-1">
              <div className="text-xs text-ink-muted">Selected Studio</div>
              <div className="text-sm font-semibold text-ink truncate">
                {studioLabel}
              </div>
              <div className="text-xs text-ink-muted truncate">
                {identity.primaryName} · {arch.shortLabel}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-ink-muted">Active Avatar DNA Size</div>
              <div className="font-mono-tabular text-sm font-semibold text-ink">
                {dnaBytes} bytes
              </div>
              <div className="text-xs text-ink-muted">
                All sliders, sockets &amp; decade age stored as JSON
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-ink-muted">1 Billion Avatars Storage</div>
              <div className="font-mono-tabular text-sm font-semibold text-accent-ink">
                ~{billionTotalTb} TB total
              </div>
              <div className="text-xs text-ink-muted">
                vs. ~280 PB if pre-baking photoreal meshes
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-ink-muted">Unlimited Re-Edits</div>
              <div className="font-mono-tabular text-sm font-semibold text-ink">
                &lt; 16 ms rebuild
              </div>
              <div className="text-xs text-ink-muted">
                Every tune mutates parameters, zero rebake
              </div>
            </div>
          </div>

          {/* Structured Architectural Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-edge text-xs font-semibold text-ink-secondary">
                  <th className="py-3 pr-4 whitespace-nowrap">Rendering Architecture</th>
                  <th className="py-3 px-4 whitespace-nowrap">Per-Avatar Footprint</th>
                  <th className="py-3 px-4 whitespace-nowrap">1B+ Avatars Cost</th>
                  <th className="py-3 px-4 whitespace-nowrap">Re-Edit &amp; Retuning</th>
                  <th className="py-3 px-4 whitespace-nowrap">Lip-Sync &amp; Blinking</th>
                  <th className="py-3 px-4 whitespace-nowrap">Device &amp; Warmth</th>
                  <th className="py-3 pl-4 text-right whitespace-nowrap">Stage Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-xs text-ink-secondary">
                {RENDER_ARCHITECTURE_COMPARISON.map((tier) => {
                  const isActiveStage =
                    (tier.id === "stylized_3d" && activeViewMode === "3d") ||
                    (tier.id === "live_2d" && activeViewMode === "rig");

                  return (
                    <tr
                      key={tier.id}
                      className={isActiveStage ? "bg-surface-alt" : "hover:bg-surface-hover"}
                    >
                      <td className="py-4 pr-4 align-top min-w-[200px]">
                        <div className="font-semibold text-ink">{tier.name}</div>
                        <div className="text-ink-muted mt-0.5 leading-relaxed">
                          {tier.roleForBillionScale}
                        </div>
                      </td>
                      <td className="py-4 px-4 align-top font-mono-tabular text-ink whitespace-nowrap">
                        {tier.perAvatarFootprint}
                      </td>
                      <td className="py-4 px-4 align-top font-mono-tabular text-ink whitespace-nowrap">
                        {tier.billionAvatarStorage}
                      </td>
                      <td className="py-4 px-4 align-top min-w-[165px] leading-relaxed">
                        {tier.reEditLatency}
                      </td>
                      <td className="py-4 px-4 align-top min-w-[190px] leading-relaxed">
                        {tier.lipSyncAndBlink}
                      </td>
                      <td className="py-4 px-4 align-top min-w-[190px] leading-relaxed">
                        <div>{tier.mobileBudget}</div>
                        <div className="text-ink-muted mt-0.5">{tier.uncannyValleyRisk}</div>
                      </td>
                      <td className="py-4 pl-4 align-top text-right whitespace-nowrap">
                        {tier.id === "stylized_3d" && (
                          <button
                            type="button"
                            onClick={() => onSelectViewMode("3d")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              activeViewMode === "3d"
                                ? "bg-accent text-accent-fg border-accent"
                                : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                            }`}
                          >
                            {activeViewMode === "3d" ? "Active on Stage" : "Use 3D Studio"}
                          </button>
                        )}
                        {tier.id === "live_2d" && (
                          <button
                            type="button"
                            onClick={() => onSelectViewMode("rig")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              activeViewMode === "rig"
                                ? "bg-accent text-accent-fg border-accent"
                                : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                            }`}
                          >
                            {activeViewMode === "rig" ? "Active on Stage" : "Use 2D Rig"}
                          </button>
                        )}
                        {tier.id === "photoreal_3d" && (
                          <button
                            type="button"
                            onClick={() => onSelectViewMode("portrait")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                              activeViewMode === "portrait"
                                ? "bg-accent text-accent-fg border-accent"
                                : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                            }`}
                          >
                            {activeViewMode === "portrait" ? "Portrait Active" : "View Portrait Tier"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Practical Hybrid Strategy Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 text-xs text-ink-muted leading-relaxed">
            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-ink">
                Why Stylized Parametric 3D Wins for 1B+ Re-Editable Avatars
              </div>
              <p>
                When billions of users customize and repeatedly redo companions across {studioLabel} and other studios, pre-baking bespoke photorealistic 3D assets per edit is computationally and financially prohibitive. Storing each companion as a compact {dnaBytes}-byte parametric DNA record lets a single shared 3D rig + socket library render endless combinations of coats, eyewear, hair silvering, and props instantaneously at 60 FPS.
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-ink">
                Hybrid Path for Optional Photorealism (MetaHuman / iClone)
              </div>
              <p>
                Keep all exploration, slider tuning, and multi-decade previews on the Stylized 3D &amp; 2D Live Rig engines. Reserve high-fidelity digital-human streaming as an optional opt-in render target hydrated from the exact same DNA parameters—so users never lose their edits or face uncanny lip-sync stalls on mobile devices.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Lifelike Facial Rig & Expression State Matrix */
        <div className="space-y-4">
          <div className="text-xs text-ink-muted leading-relaxed">
            Each expression state combines damped skeletal head kinematics, asymmetrical eyebrow weights, Duchenne lower-eyelid cheek lift, and articulated jaw/lip curves—layered independently beneath spontaneous blinking, ribcage breathing, eye micro-saccades, and real-time phoneme lip-sync.
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-edge text-xs font-semibold text-ink-secondary">
                  <th className="py-3 pr-4 whitespace-nowrap">Expression State</th>
                  <th className="py-3 px-4 whitespace-nowrap">Target Muscle Group</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Jaw Drop</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Smile Curve</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Brow L / R</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Eye Squint L / R</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Head Tilt / Pitch</th>
                  <th className="py-3 pl-4 text-right whitespace-nowrap">Trigger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-xs text-ink-secondary">
                {(Object.keys(FACIAL_RIG_STATES) as GestureId[]).map((key) => {
                  const spec = FACIAL_RIG_STATES[key];
                  const isCurrent = activeGesture === key;
                  return (
                    <tr
                      key={key}
                      className={isCurrent ? "bg-surface-alt" : "hover:bg-surface-hover"}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-semibold text-ink">{spec.label}</div>
                        <div className="text-[11px] text-ink-muted">{spec.cue}</div>
                      </td>
                      <td className="py-3 px-4 text-ink-muted">{spec.muscleGroup}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {Math.round(spec.jawDrop * 100)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {spec.smileCurve >= 0 ? `+${Math.round(spec.smileCurve * 100)}%` : `${Math.round(spec.smileCurve * 100)}%`}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap">
                        {Math.round(spec.browLiftL * 100)}% / {Math.round(spec.browLiftR * 100)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap">
                        {Math.round(spec.eyeSquintL * 100)}% / {Math.round(spec.eyeSquintR * 100)}%
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular whitespace-nowrap">
                        {spec.headTiltDeg}° / {spec.headPitchDeg}°
                      </td>
                      <td className="py-3 pl-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectGesture(key)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                            isCurrent
                              ? "bg-accent text-accent-fg border-accent"
                              : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
                          }`}
                        >
                          <Play className="w-3 h-3" />
                          {isCurrent ? "Active" : "Preview"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
