/**
 * Guided modal for designing and saving new ElevenLabs voices inside AI Studio.
 * Keeps the voice-design UI isolated from the main voices workflow shell.
 */
import React from "react";
import { Pause, Play, X } from "phosphor-react";

export type CreateVoiceModalPreview = {
  generatedVoiceId: string;
  durationSecs: number | null;
  language: string | null;
  audioSrc: string;
};

type CreateVoiceModalProps = {
  createMode: "generate" | "clone";
  voiceName: string;
  voicePrompt: string;
  voiceNameInputRef: React.Ref<HTMLInputElement>;
  voicePromptRef: React.Ref<HTMLTextAreaElement>;
  normalizedVoicePromptLength: number;
  minVoicePromptCharacters: number;
  maxVoicePromptCharacters: number;
  voiceDescriptionPlaceholder: string;
  isCreateVoiceEnabled: boolean;
  isSaveVoiceEnabled: boolean;
  isSavingDesignedVoice: boolean;
  cloneSourceIntake: React.ReactNode;
  isCloneConsentChecked: boolean;
  isCloneVoiceEnabled: boolean;
  isCloningVoice: boolean;
  voiceDesignPreviewText: string | null;
  voiceDesignPreviews: CreateVoiceModalPreview[];
  selectedVoiceDesignPreviewId: string | null;
  activeDesignedPreviewId: string | null;
  voiceDesignError: string | null;
  saveVoiceError: string | null;
  cloneVoiceError: string | null;
  onClose: () => void;
  onCreateModeChange: (nextMode: "generate" | "clone") => void;
  onVoiceNameChange: (nextValue: string) => void;
  onVoicePromptChange: (nextValue: string) => void;
  onCloneConsentChange: (nextValue: boolean) => void;
  onVoicePromptDrop: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onVoicePromptDragOver: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onGenerateVoicePreviews: () => void;
  onSaveVoice: () => void;
  onCloneVoice: () => void;
  onSelectPreview: (previewId: string) => void;
  onPlayPreview: (previewId: string, previewUrl: string) => void;
};

const formatPreviewDuration = (durationSecs: number | null): string | null => {
  if (durationSecs == null || !Number.isFinite(durationSecs)) return null;
  return `${durationSecs.toFixed(durationSecs >= 10 ? 0 : 1)}s`;
};

/**
 * Renders the voice design modal content and preview audition states.
 */
export function CreateVoiceModal({
  createMode,
  voiceName,
  voicePrompt,
  voiceNameInputRef,
  voicePromptRef,
  maxVoicePromptCharacters,
  voiceDescriptionPlaceholder,
  isCreateVoiceEnabled,
  isSaveVoiceEnabled,
  isSavingDesignedVoice,
  cloneSourceIntake,
  isCloneConsentChecked,
  isCloneVoiceEnabled,
  isCloningVoice,
  voiceDesignPreviews,
  selectedVoiceDesignPreviewId,
  activeDesignedPreviewId,
  voiceDesignError,
  saveVoiceError,
  cloneVoiceError,
  onClose,
  onCreateModeChange,
  onVoiceNameChange,
  onVoicePromptChange,
  onCloneConsentChange,
  onVoicePromptDrop,
  onVoicePromptDragOver,
  onGenerateVoicePreviews,
  onSaveVoice,
  onCloneVoice,
  onSelectPreview,
  onPlayPreview,
}: CreateVoiceModalProps) {
  const hasPreviewOptions = voiceDesignPreviews.length > 0;
  const isCloneMode = createMode === "clone";

  return (
    <div className="voices-create-modal-backdrop" onClick={onClose}>
      <div
        className={`voices-create-modal${isCloneMode ? " voices-create-modal--clone" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="voices-create-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="voices-create-modal-header">
          <h2 id="voices-create-modal-title" className="voices-create-modal-title">
            Create New Voice
          </h2>
          <button
            type="button"
            className="voices-properties-create-panel-close"
            aria-label="Close create voice modal"
            onClick={onClose}
          >
            <X size={15} weight="bold" aria-hidden="true" />
          </button>
        </div>

        <div className="voices-create-modal-scroll">
          <div className="voices-create-modal-body">
            <div
              className="voices-create-modal-method-tabs voices-properties-mode-tabs"
              role="tablist"
              aria-label="Voice creation method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={createMode === "generate"}
                className={`voices-properties-mode-tab ${
                  createMode === "generate" ? "is-active" : ""
                }`}
                onClick={() => onCreateModeChange("generate")}
              >
                Generate Voice
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={createMode === "clone"}
                data-voice-mode="voice-changer"
                className={`voices-properties-mode-tab ${isCloneMode ? "is-active" : ""}`}
                onClick={() => onCreateModeChange("clone")}
              >
                Clone Voice
              </button>
            </div>

            <div className="voices-create-modal-form">
              <label className="voices-properties-field">
                <span className="voices-properties-field-label">Voice name</span>
                <input
                  ref={voiceNameInputRef}
                  className="voices-properties-input voices-create-modal-input"
                  value={voiceName}
                  onChange={(event) => onVoiceNameChange(event.target.value)}
                  placeholder="Late-night storyteller"
                  aria-label="Voice name"
                  autoFocus
                />
              </label>

              <label className="voices-properties-field">
                <span className="voices-properties-field-label">
                  {isCloneMode ? "Voice description (optional)" : "Voice description"}
                </span>
                <textarea
                  ref={voicePromptRef}
                  className="voices-properties-rail-textarea voices-properties-rail-textarea--modal voices-create-modal-textarea"
                  value={voicePrompt}
                  onChange={(event) => onVoicePromptChange(event.target.value)}
                  onDrop={isCloneMode ? undefined : onVoicePromptDrop}
                  onDragOver={isCloneMode ? undefined : onVoicePromptDragOver}
                  maxLength={maxVoicePromptCharacters}
                  placeholder={
                    isCloneMode
                      ? "Optional notes for this cloned voice."
                      : voiceDescriptionPlaceholder
                  }
                  aria-label="Voice description"
                />
              </label>

              {isCloneMode ? (
                <section className="voices-create-modal-clone-source" aria-label="Voice sample">
                  <p className="voices-properties-field-label">Voice sample</p>
                  {cloneSourceIntake}
                </section>
              ) : null}

              {isCloneMode ? (
                <label className="voices-create-modal-consent">
                  <input
                    type="checkbox"
                    checked={isCloneConsentChecked}
                    onChange={(event) => onCloneConsentChange(event.target.checked)}
                    disabled={isCloningVoice}
                  />
                  <span>I have permission to clone this voice.</span>
                </label>
              ) : null}

              {isCloneMode && cloneVoiceError ? (
                <p className="voices-create-modal-alert" role="alert">
                  {cloneVoiceError}
                </p>
              ) : null}

              {!isCloneMode && voiceDesignError ? (
                <p className="voices-create-modal-alert" role="alert">
                  {voiceDesignError}
                </p>
              ) : null}

              {!isCloneMode ? (
                <div className="voices-create-modal-actions">
                  <button
                    type="button"
                    className="voices-properties-create-voice-btn voices-create-modal-primary-btn"
                    disabled={!isCreateVoiceEnabled}
                    aria-label="Generate voice previews"
                    onClick={onGenerateVoicePreviews}
                  >
                    {hasPreviewOptions ? "Regenerate previews" : "Generate previews"}
                  </button>
                </div>
              ) : null}
            </div>

            {!isCloneMode && hasPreviewOptions ? (
              <section
                className="voices-create-modal-preview-section"
                aria-label="Generated voice previews"
              >
                <p className="voices-properties-field-label">Generated voice previews</p>
                <div className="voices-properties-generated-preview-list">
                  {voiceDesignPreviews.map((preview, index) => {
                    const isSelected = selectedVoiceDesignPreviewId === preview.generatedVoiceId;
                    const isPreviewPlaying = activeDesignedPreviewId === preview.generatedVoiceId;
                    const previewMeta = [
                      preview.language?.trim() || null,
                      formatPreviewDuration(preview.durationSecs),
                    ].filter(Boolean);

                    return (
                      <div
                        key={preview.generatedVoiceId}
                        className={`voices-properties-generated-preview-option ${
                          isSelected ? "is-selected" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="voices-properties-generated-preview-play"
                          aria-label={`${
                            isPreviewPlaying ? "Stop" : "Play"
                          } generated preview ${index + 1}`}
                          aria-pressed={isPreviewPlaying}
                          onClick={() => onPlayPreview(preview.generatedVoiceId, preview.audioSrc)}
                        >
                          <span
                            className="voices-properties-generated-preview-play-icon"
                            aria-hidden="true"
                          >
                            {isPreviewPlaying ? (
                              <Pause size={12} weight="fill" />
                            ) : (
                              <Play size={12} weight="fill" />
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          className="voices-properties-generated-preview-select"
                          aria-pressed={isSelected}
                          aria-label={`Select generated preview ${index + 1}`}
                          onClick={() => onSelectPreview(preview.generatedVoiceId)}
                        >
                          <span className="voices-properties-generated-preview-row">
                            <span className="voices-properties-generated-preview-label">
                              Preview {index + 1}
                            </span>
                            {isSelected ? (
                              <span className="voices-properties-generated-preview-badge">
                                Selected
                              </span>
                            ) : null}
                          </span>
                          {previewMeta.length > 0 ? (
                            <span className="voices-properties-generated-preview-meta">
                              {previewMeta.join(" · ")}
                            </span>
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {!isCloneMode && saveVoiceError ? (
              <p className="voices-create-modal-alert" role="alert">
                {saveVoiceError}
              </p>
            ) : null}

            <div className="voices-create-modal-footer">
              <button
                type="button"
                className="voices-properties-save-btn voices-create-modal-save-btn"
                onClick={isCloneMode ? onCloneVoice : onSaveVoice}
                disabled={isCloneMode ? !isCloneVoiceEnabled : !isSaveVoiceEnabled}
              >
                {isCloneMode
                  ? isCloningVoice
                    ? "Creating cloned voice..."
                    : "Create cloned voice"
                  : isSavingDesignedVoice
                    ? "Saving…"
                    : "Save voice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
