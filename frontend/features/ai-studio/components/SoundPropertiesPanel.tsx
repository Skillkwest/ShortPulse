/**
 * Sound landing properties panel for AI Studio.
 * Routes users into the real Voice, Music, and SFX workflows instead of showing a fake inspector.
 */
import React from "react";
import { Microphone, SpeakerHigh, WaveSine, type Icon } from "phosphor-react";
import type { ToolId } from "../types";

type SoundWorkflowCard = {
  id: Extract<ToolId, "voices" | "music" | "sound-effects">;
  title: string;
  eyebrow: string;
  summary: string;
  actionLabel: string;
  icon: Icon;
};

export type SoundPropertiesPanelProps = {
  onSelectTool?: (tool: Extract<ToolId, "voices" | "music" | "sound-effects">) => void;
};

const soundWorkflowCards: readonly SoundWorkflowCard[] = [
  {
    id: "voices",
    title: "Voice",
    eyebrow: "Speech",
    summary:
      "Create voiceovers, cloned voices, and voice conversions from the dedicated voice workflow.",
    actionLabel: "Open Voice workflow",
    icon: Microphone,
  },
  {
    id: "music",
    title: "Music",
    eyebrow: "Songs",
    summary: "Write cues, full songs, and custom lyric-driven music inside the music workflow.",
    actionLabel: "Open Music workflow",
    icon: WaveSine,
  },
  {
    id: "sound-effects",
    title: "SFX",
    eyebrow: "Effects",
    summary: "Generate impacts, accents, and loopable sound effects in the SFX workflow.",
    actionLabel: "Open SFX workflow",
    icon: SpeakerHigh,
  },
] as const;

export const SoundPropertiesPanel = React.memo(function SoundPropertiesPanel({
  onSelectTool,
}: SoundPropertiesPanelProps) {
  return (
    <section className="sound-properties-panel tool-properties" aria-label="Sound properties">
      <div className="tool-header sound-properties-header">
        <div>
          <p className="eyebrow">Sound</p>
          <h2 className="panel-title">Sound Workflows</h2>
          <p className="tiny subdued sound-properties-subtitle">
            Choose the dedicated workflow you want to work in. Voice, Music, and SFX each keep their
            own controls and generation surface.
          </p>
        </div>
      </div>

      <div className="sound-properties-shell sound-properties-shell--landing">
        <section className="sound-properties-card sound-properties-landing-card">
          <div className="sound-properties-landing-copy">
            <p className="sound-properties-card-kicker">Workflow hub</p>
            <h3 className="sound-properties-card-title">Pick a sound lane</h3>
            <p className="sound-properties-card-text">
              The top-level Sound view is now a router into the real audio tools instead of a
              generic inspector.
            </p>
          </div>
          <div className="sound-properties-landing-grid" aria-label="Available sound workflows">
            {soundWorkflowCards.map((workflow) => {
              const Icon = workflow.icon;
              return (
                <button
                  key={workflow.id}
                  type="button"
                  className="sound-properties-workflow-card"
                  aria-label={workflow.actionLabel}
                  onClick={() => onSelectTool?.(workflow.id)}
                >
                  <span className="sound-properties-workflow-icon" aria-hidden="true">
                    <Icon size={20} weight="bold" aria-hidden="true" />
                  </span>
                  <span className="sound-properties-workflow-copy">
                    <span className="sound-properties-workflow-kicker">{workflow.eyebrow}</span>
                    <span className="sound-properties-workflow-title">{workflow.title}</span>
                    <span className="sound-properties-workflow-summary">{workflow.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
});
