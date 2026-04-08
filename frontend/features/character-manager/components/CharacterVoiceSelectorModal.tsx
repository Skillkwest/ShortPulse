/**
 * Character voice selector modal.
 * Quarantined while Character Profile voice controls remain hidden from the current UI.
 */
import React, { useMemo, useState } from "react";
import { MagnifyingGlass, Microphone } from "phosphor-react";
import {
  AiStudioModalLayer,
  useAiStudioModalActivity,
} from "../../ai-studio/components/modal-layer/AiStudioModalLayer";
import { VOICE_LIBRARY_OPTIONS, type VoiceLibraryOption } from "../../ai-studio/voiceLibrary";

type CharacterVoiceSelectorModalProps = {
  isOpen: boolean;
  selectedVoiceValue: string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

const EMPTY_VOICE_COPY = "No saved voices match that search yet.";

/**
 * Renders a saved-voice picker for the Character Profile voice selector.
 */
export function CharacterVoiceSelectorModal({
  isOpen,
  selectedVoiceValue,
  onClose,
  onSelect,
}: CharacterVoiceSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  useAiStudioModalActivity("character-voice-selector-modal", isOpen);

  const filteredVoices = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return VOICE_LIBRARY_OPTIONS;
    }
    return VOICE_LIBRARY_OPTIONS.filter((voice) =>
      `${voice.title} ${voice.descriptor}`.toLowerCase().includes(normalizedQuery)
    );
  }, [searchQuery]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  const handleSelect = (value: string) => {
    setSearchQuery("");
    onSelect(value);
  };

  return (
    <AiStudioModalLayer>
      <div className="model-modal-backdrop" onClick={handleClose}>
        <div
          className="model-modal character-voice-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="character-voice-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="model-modal-header">
            <div className="model-modal-title-group">
              <p id="character-voice-modal-title" className="model-modal-title">
                Voices
              </p>
              <p className="model-modal-subtitle">Choose a saved voice from the Voice library.</p>
            </div>
            <div className="model-modal-header-actions">
              <div className="model-modal-search">
                <MagnifyingGlass
                  aria-hidden
                  className="model-search-icon"
                  size={14}
                  weight="bold"
                />
                <input
                  className="model-search-input"
                  type="search"
                  placeholder="Search voices"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <button
                type="button"
                className="ghost-btn mini model-modal-close"
                onClick={handleClose}
                aria-label="Close voice picker"
              >
                Close
              </button>
            </div>
          </div>

          <div className="model-modal-scroll">
            {filteredVoices.length ? (
              <div className="model-modal-section">
                <div className="model-modal-grid">
                  {filteredVoices.map((voice) => (
                    <VoiceChip
                      key={voice.value}
                      voice={voice}
                      isSelected={voice.value === selectedVoiceValue}
                      onSelect={handleSelect}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="character-voice-modal-empty">
                <p>{EMPTY_VOICE_COPY}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AiStudioModalLayer>
  );
}

function VoiceChip({
  voice,
  isSelected,
  onSelect,
}: {
  voice: VoiceLibraryOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className={`model-chip character-voice-chip${isSelected ? " is-selected" : ""}`}
      onClick={() => onSelect(voice.value)}
      aria-pressed={isSelected}
    >
      <div className="model-chip-row">
        <div className="model-chip-content">
          <span className="character-voice-chip-avatar" aria-hidden="true">
            <Microphone size={16} weight="fill" />
          </span>
          <div className="model-chip-text">
            <span className="model-chip-title">{voice.title}</span>
            <span className="model-chip-subtitle">{voice.descriptor}</span>
          </div>
        </div>
        <span className="model-chip-pill">
          <span aria-hidden="true" className="model-chip-icon">
            {isSelected ? "●" : "◦"}
          </span>
          <span className="model-chip-credits">{isSelected ? "Selected" : "Saved"}</span>
        </span>
      </div>
    </button>
  );
}
