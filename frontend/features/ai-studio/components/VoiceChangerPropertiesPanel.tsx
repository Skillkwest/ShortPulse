/**
 * Voice changer properties panel for AI Studio.
 * Provides a minimal, decoupled surface for staging voice transformation.
 */
import React from "react";
import { CaretDown, UploadSimple } from "phosphor-react";

type VoiceChangerMode = "replace" | "match";

const panelModes: Array<{
  id: VoiceChangerMode;
  label: string;
}> = [
  { id: "replace", label: "Replace Voice" },
  { id: "match", label: "Match Delivery" },
];

const modePlaceholders: Record<VoiceChangerMode, string> = {
  replace:
    "Describe how the original speaker should change. Focus on tone, age, energy, and where the transformed voice will be used.",
  match:
    "Describe the target voice while keeping the original cadence and phrasing as close as possible.",
};

const targetVoiceOptions = ["Nova", "Ember", "Grit"] as const;

const maxTransformCharacters = 700;

/**
 * Renders the dedicated Voice Changer workflow panel.
 */
export const VoiceChangerPropertiesPanel = React.memo(function VoiceChangerPropertiesPanel() {
  const [panelMode, setPanelMode] = React.useState<VoiceChangerMode>("replace");
  const [jobName, setJobName] = React.useState("Podcast intro alt");
  const [targetVoice, setTargetVoice] = React.useState<(typeof targetVoiceOptions)[number]>("Nova");
  const [preserveTiming, setPreserveTiming] = React.useState("Locked");
  const [transformNotes, setTransformNotes] = React.useState(
    "Swap the original speaker for a cleaner, brighter delivery while keeping cadence close to the source."
  );

  const notesRef = React.useRef<HTMLTextAreaElement | null>(null);
  const isTransformEnabled = jobName.trim().length > 0 && transformNotes.trim().length > 0;

  React.useLayoutEffect(() => {
    const field = notesRef.current;
    if (!field) {
      return;
    }

    const syncHeight = () => {
      const textarea = notesRef.current;
      if (!textarea) {
        return;
      }

      const minimumHeight = 240;
      textarea.style.height = `${minimumHeight}px`;

      const { top } = textarea.getBoundingClientRect();
      const maximumHeight = Math.max(minimumHeight, Math.floor(window.innerHeight - top - 150));
      const nextHeight = Math.min(textarea.scrollHeight, maximumHeight);

      textarea.style.height = `${Math.max(minimumHeight, nextHeight)}px`;
      textarea.style.maxHeight = `${maximumHeight}px`;
      textarea.style.overflowY = textarea.scrollHeight > maximumHeight ? "auto" : "hidden";
    };

    syncHeight();
    window.addEventListener("resize", syncHeight);

    return () => {
      window.removeEventListener("resize", syncHeight);
    };
  }, [transformNotes]);

  return (
    <section
      className="voice-changer-properties-panel tool-properties"
      aria-label="Voice changer properties"
    >
      <div className="tool-header voice-changer-properties-header">
        <p className="eyebrow">Sound</p>
        <h2 className="panel-title voice-changer-properties-title">Voice Changer</h2>
      </div>

      <div className="voice-changer-properties-shell">
        <div className="voice-changer-properties-main">
          <div className="voice-changer-properties-script-divider" aria-hidden="true" />
          <div className="voice-changer-properties-compose-area">
            <textarea
              ref={notesRef}
              className="voice-changer-properties-script-input"
              value={transformNotes}
              onChange={(event) => setTransformNotes(event.target.value)}
              maxLength={maxTransformCharacters}
              placeholder={modePlaceholders[panelMode]}
              aria-label="Transformation notes"
            />
            <div className="voice-changer-properties-script-divider" aria-hidden="true" />
            <div className="voice-changer-properties-script-actions">
              <p className="voice-changer-properties-script-count" aria-live="polite">
                {transformNotes.length.toLocaleString()} / {maxTransformCharacters.toLocaleString()}
              </p>
              <button
                type="button"
                className="voice-changer-properties-primary-btn"
                disabled={!isTransformEnabled}
              >
                Transform voice
              </button>
            </div>
          </div>
        </div>

        <div className="voice-changer-properties-column-shell voice-changer-properties-column-shell--aside">
          <aside className="voice-changer-properties-aside">
            <section className="voice-changer-properties-card">
              <div className="voice-changer-properties-card-heading-row">
                <p className="voice-changer-properties-card-kicker">Mode</p>
              </div>

              <div
                className="voice-changer-properties-mode-row"
                role="tablist"
                aria-label="Voice changer modes"
              >
                {panelModes.map((mode) => {
                  const isActive = mode.id === panelMode;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      role="tab"
                      aria-label={mode.label}
                      aria-selected={isActive}
                      className={`voice-changer-properties-mode-tab ${isActive ? "is-active" : ""}`}
                      onClick={() => setPanelMode(mode.id)}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="voice-changer-properties-card">
              <div className="voice-changer-properties-card-heading-row">
                <p className="voice-changer-properties-card-kicker">Transform setup</p>
              </div>

              <label className="voice-changer-properties-field">
                <span className="voice-changer-properties-field-label">Job name</span>
                <input
                  className="voice-changer-properties-input"
                  value={jobName}
                  onChange={(event) => setJobName(event.target.value)}
                  placeholder="Name this transform pass"
                />
              </label>

              <label className="voice-changer-properties-field">
                <span className="voice-changer-properties-field-label">Target voice</span>
                <span className="voice-changer-properties-select-shell">
                  <select
                    className="voice-changer-properties-select"
                    value={targetVoice}
                    onChange={(event) =>
                      setTargetVoice(event.target.value as (typeof targetVoiceOptions)[number])
                    }
                    aria-label="Target voice"
                  >
                    {targetVoiceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <CaretDown size={14} weight="bold" aria-hidden="true" />
                </span>
              </label>

              <label className="voice-changer-properties-field">
                <span className="voice-changer-properties-field-label">Preserve timing</span>
                <span className="voice-changer-properties-select-shell">
                  <select
                    className="voice-changer-properties-select"
                    value={preserveTiming}
                    onChange={(event) => setPreserveTiming(event.target.value)}
                    aria-label="Preserve timing"
                  >
                    <option>Locked</option>
                    <option>Flexible</option>
                    <option>Loose</option>
                  </select>
                  <CaretDown size={14} weight="bold" aria-hidden="true" />
                </span>
              </label>
            </section>

            <section className="voice-changer-properties-card">
              <div className="voice-changer-properties-card-heading-row">
                <p className="voice-changer-properties-card-kicker">Source audio</p>
              </div>

              <button type="button" className="voice-changer-properties-upload-card">
                <UploadSimple size={16} weight="bold" aria-hidden="true" />
                <span className="voice-changer-properties-upload-copy">
                  <strong>Upload source clip</strong>
                  <span>Drop dialogue or narration audio to stage the transform.</span>
                </span>
              </button>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
});
