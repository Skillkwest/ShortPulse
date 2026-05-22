/**
 * Shared voice library content for the AI Studio voices workflow.
 * Renders loading/error states plus the selectable voice chip grid used by the voices modal.
 */
import React from "react";
import { Microphone } from "phosphor-react";
import type { SharedVoiceOption } from "../hooks/useSharedVoicesGrid";

type VoiceLibraryContentProps = {
  libraryVoices: SharedVoiceOption[];
  selectedLibraryVoice: SharedVoiceOption | null;
  activeLibrarySection: "default" | "my";
  activePreviewVoiceId: string | null;
  isVoicesLoading: boolean;
  voicesLoadError: string | null;
  voicesLoadNotice: string | null;
  voiceLoadingSkeletonCount: number;
  getVoiceChipDisplayName: (voiceName: string) => string;
  onActiveLibrarySectionChange: (nextSection: "default" | "my") => void;
  onSelectVoice: (voiceId: string) => void;
  onPreviewVoice: (voiceId: string, previewUrl: string | null | undefined) => void;
};

/**
 * Renders the reusable voices chip library with loading and feedback states.
 */
export function VoiceLibraryContent({
  libraryVoices,
  selectedLibraryVoice,
  activeLibrarySection,
  activePreviewVoiceId,
  isVoicesLoading,
  voicesLoadError,
  voicesLoadNotice,
  voiceLoadingSkeletonCount,
  getVoiceChipDisplayName,
  onActiveLibrarySectionChange,
  onSelectVoice,
  onPreviewVoice,
}: VoiceLibraryContentProps) {
  const defaultVoices = React.useMemo(
    () => libraryVoices.filter((voice) => voice.librarySection === "default"),
    [libraryVoices]
  );
  const myVoices = React.useMemo(
    () => libraryVoices.filter((voice) => voice.librarySection === "my"),
    [libraryVoices]
  );
  const visibleVoices = activeLibrarySection === "my" ? myVoices : defaultVoices;
  const defaultTabId = "voices-library-tab-default";
  const myTabId = "voices-library-tab-my";

  return (
    <>
      <div className="voices-library-modal-tabs" role="tablist" aria-label="Voice library sections">
        <button
          type="button"
          id={myTabId}
          role="tab"
          className={`voices-library-modal-tab ${activeLibrarySection === "my" ? "is-active" : ""}`}
          aria-selected={activeLibrarySection === "my"}
          aria-controls="voices-library-panel-my"
          onClick={() => onActiveLibrarySectionChange("my")}
        >
          My Voices
        </button>
        <button
          type="button"
          id={defaultTabId}
          role="tab"
          className={`voices-library-modal-tab ${
            activeLibrarySection === "default" ? "is-active" : ""
          }`}
          aria-selected={activeLibrarySection === "default"}
          aria-controls="voices-library-panel-default"
          onClick={() => onActiveLibrarySectionChange("default")}
        >
          Default Voices
        </button>
      </div>
      {voicesLoadError ? <p className="tiny subdued">{voicesLoadError}</p> : null}
      {voicesLoadNotice ? <p className="tiny subdued">{voicesLoadNotice}</p> : null}
      <div
        id={
          activeLibrarySection === "my" ? "voices-library-panel-my" : "voices-library-panel-default"
        }
        role="tabpanel"
        aria-labelledby={activeLibrarySection === "my" ? myTabId : defaultTabId}
      >
        {!isVoicesLoading && visibleVoices.length === 0 ? (
          <p className="voices-library-modal-empty tiny subdued">
            {activeLibrarySection === "my"
              ? "You have not created any saved voices yet."
              : "No default voices are available right now."}
          </p>
        ) : null}
        <ul className="voices-properties-voice-grid" aria-label="Available voices list">
          {isVoicesLoading ? (
            <>
              <li className="sr-only" role="status" aria-live="polite">
                Loading voices…
              </li>
              {Array.from({ length: voiceLoadingSkeletonCount }, (_, index) => (
                <li
                  key={`voice-loading-skeleton-${index + 1}`}
                  className="voices-properties-voice-item"
                  aria-hidden="true"
                >
                  <div className="voices-properties-voice-chip voices-properties-voice-chip--skeleton">
                    <span className="voices-properties-voice-chip-avatar voices-properties-voice-chip-skeleton-block" />
                    <span className="voices-properties-voice-chip-copy">
                      <span className="voices-properties-voice-chip-label voices-properties-voice-chip-skeleton-line voices-properties-voice-chip-skeleton-line--label" />
                      <span className="voices-properties-voice-chip-name voices-properties-voice-chip-skeleton-line voices-properties-voice-chip-skeleton-line--name" />
                    </span>
                    <span className="voices-properties-voice-chip-play voices-properties-voice-chip-play--skeleton">
                      <span className="voices-properties-voice-chip-skeleton-block voices-properties-voice-chip-skeleton-block--play" />
                    </span>
                  </div>
                </li>
              ))}
            </>
          ) : (
            visibleVoices.map((voice) => {
              const isSelected = voice.id === selectedLibraryVoice?.id;
              const isPreviewPlaying = voice.id === activePreviewVoiceId;
              const voiceChipDisplayName = getVoiceChipDisplayName(voice.name);
              return (
                <li key={voice.id} className="voices-properties-voice-item">
                  <div
                    className={`voices-properties-voice-chip ${isSelected ? "is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="voices-properties-voice-chip-select"
                      aria-pressed={isSelected}
                      aria-label={`${voice.name} voice`}
                      onClick={() => onSelectVoice(voice.id)}
                    >
                      <span className="voices-properties-voice-chip-avatar" aria-hidden="true">
                        <Microphone size={14} weight="bold" />
                      </span>
                      <span className="voices-properties-voice-chip-copy">
                        <span className="voices-properties-voice-chip-label">Voice</span>
                        <span className="voices-properties-voice-chip-name">
                          {voiceChipDisplayName}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      className="voices-properties-voice-chip-play"
                      aria-label={`${isPreviewPlaying ? "Stop" : "Play"} ${voice.name} sample`}
                      aria-pressed={isPreviewPlaying}
                      disabled={!voice.previewUrl}
                      onClick={() => onPreviewVoice(voice.id, voice.previewUrl)}
                    >
                      <span className="voices-properties-voice-chip-play-icon" aria-hidden="true">
                        {isPreviewPlaying ? "❚❚" : "▶"}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </>
  );
}
