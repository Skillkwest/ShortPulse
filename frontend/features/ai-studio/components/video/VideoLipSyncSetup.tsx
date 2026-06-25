/**
 * Lip Sync settings and reference setup wrapper for the Video workflow.
 */
import React from "react";
import { VideoSettingsCardPrefab } from "../VideoSettingsCardPrefab";

type VideoLipSyncSetupProps = {
  settingsProps: React.ComponentProps<typeof VideoSettingsCardPrefab>;
  lipSyncAudioInputRef: React.RefObject<HTMLInputElement>;
  handleLipSyncAudioSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  lipSyncTurboMode: boolean;
  onLipSyncTurboModeChange?: (value: boolean) => void;
  showTurboControl: boolean;
  referenceMediaStep: React.ReactNode;
};

/**
 * Renders the Lip Sync-specific setup column without changing Video settings behavior.
 */
export function VideoLipSyncSetup({
  settingsProps,
  lipSyncAudioInputRef,
  handleLipSyncAudioSelection,
  lipSyncTurboMode,
  onLipSyncTurboModeChange,
  showTurboControl,
  referenceMediaStep,
}: VideoLipSyncSetupProps) {
  return (
    <>
      <div className="video-lip-sync-settings-slot">
        <VideoSettingsCardPrefab {...settingsProps} />
      </div>
      <div className="video-lip-sync-setup-card">
        <input
          ref={lipSyncAudioInputRef}
          className="sr-only"
          type="file"
          accept="audio/*"
          onChange={handleLipSyncAudioSelection}
        />
        {showTurboControl ? (
          <label className="video-lip-sync-toggle-row">
            <span>Faster generation</span>
            <button
              type="button"
              className={`video-lip-sync-switch audio-toggle ${lipSyncTurboMode ? "is-active" : ""}`}
              role="switch"
              aria-checked={lipSyncTurboMode}
              aria-label="Faster generation"
              onClick={() => onLipSyncTurboModeChange?.(!lipSyncTurboMode)}
            >
              <span className="audio-toggle-track" aria-hidden="true">
                <span className="audio-toggle-dot" />
              </span>
            </button>
          </label>
        ) : null}
        <div className="video-lip-sync-reference-slot video-setup-reference-slot">
          {referenceMediaStep}
        </div>
      </div>
    </>
  );
}
