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
  isDesigningVoice: boolean;
  isSavingDesignedVoice: boolean;
  voiceDesignPreviewText: string | null;
  voiceDesignPreviews: CreateVoiceModalPreview[];
  selectedVoiceDesignPreviewId: string | null;
  activeDesignedPreviewId: string | null;
  voiceDesignError: string | null;
  saveVoiceError: string | null;
  onClose: () => void;
  onVoiceNameChange: (nextValue: string) => void;
  onVoicePromptChange: (nextValue: string) => void;
  onVoicePromptDrop: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onVoicePromptDragOver: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onGenerateVoicePreviews: () => void;
  onSaveVoice: () => void;
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
  voiceName,
  voicePrompt,
  voiceNameInputRef,
  voicePromptRef,
  maxVoicePromptCharacters,
  voiceDescriptionPlaceholder,
  isCreateVoiceEnabled,
  isSaveVoiceEnabled,
  isDesigningVoice,
  isSavingDesignedVoice,
  voiceDesignPreviews,
  selectedVoiceDesignPreviewId,
  activeDesignedPreviewId,
  voiceDesignError,
  saveVoiceError,
  onClose,
  onVoiceNameChange,
  onVoicePromptChange,
  onVoicePromptDrop,
  onVoicePromptDragOver,
  onGenerateVoicePreviews,
  onSaveVoice,
  onSelectPreview,
  onPlayPreview,
}: CreateVoiceModalProps) {
  const hasPreviewOptions = voiceDesignPreviews.length > 0;

  return (
    <div className="voices-create-modal-backdrop" onClick={onClose}>
      <div
        className="voices-create-modal"
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
                />
              </label>

              <label className="voices-properties-field">
                <span className="voices-properties-field-label">Voice description</span>
                <textarea
                  ref={voicePromptRef}
                  className="voices-properties-rail-textarea voices-properties-rail-textarea--modal voices-create-modal-textarea"
                  value={voicePrompt}
                  onChange={(event) => onVoicePromptChange(event.target.value)}
                  onDrop={onVoicePromptDrop}
                  onDragOver={onVoicePromptDragOver}
                  maxLength={maxVoicePromptCharacters}
                  placeholder={voiceDescriptionPlaceholder}
                  aria-label="Voice description"
                />
              </label>

              {voiceDesignError ? (
                <p className="voices-create-modal-alert" role="alert">
                  {voiceDesignError}
                </p>
              ) : null}

              <div className="voices-create-modal-actions">
                <button
                  type="button"
                  className="voices-properties-create-voice-btn voices-create-modal-primary-btn"
                  disabled={!isCreateVoiceEnabled}
                  aria-label="Generate voice previews"
                  onClick={onGenerateVoicePreviews}
                >
                  {isDesigningVoice
                    ? "Generating…"
                    : hasPreviewOptions
                      ? "Regenerate previews"
                      : "Generate previews"}
                </button>
              </div>
            </div>

            {hasPreviewOptions ? (
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

            {saveVoiceError ? (
              <p className="voices-create-modal-alert" role="alert">
                {saveVoiceError}
              </p>
            ) : null}

            <div className="voices-create-modal-footer">
              <button
                type="button"
                className="voices-properties-save-btn voices-create-modal-save-btn"
                onClick={onSaveVoice}
                disabled={!isSaveVoiceEnabled}
              >
                {isSavingDesignedVoice ? "Saving…" : "Save voice"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
