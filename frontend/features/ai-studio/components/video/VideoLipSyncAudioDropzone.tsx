/**
 * Lip Sync voice-audio dropzone for the Video workflow.
 */
import React from "react";
import { UploadSimple } from "phosphor-react";
import type { LipSyncAudioState } from "../../types";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";

type VideoLipSyncAudioDropzoneProps = {
  lipSyncAudio: LipSyncAudioState;
  lipSyncAudioPlaybackUrl: string | null;
  lipSyncAudioDragActive: boolean;
  lipSyncAudioCanvasTearOutActive: boolean;
  lipSyncAudioInputRef: React.RefObject<HTMLInputElement>;
  lipSyncAudioDropzoneRef: React.RefObject<HTMLDivElement>;
  setLipSyncAudioDragActive: (active: boolean) => void;
  handleLipSyncAudioDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  clearLipSyncAudio: () => void;
};

/**
 * Renders the Lip Sync audio slot without owning upload or storage authority.
 */
export function VideoLipSyncAudioDropzone({
  lipSyncAudio,
  lipSyncAudioPlaybackUrl,
  lipSyncAudioDragActive,
  lipSyncAudioCanvasTearOutActive,
  lipSyncAudioInputRef,
  lipSyncAudioDropzoneRef,
  setLipSyncAudioDragActive,
  handleLipSyncAudioDrop,
  clearLipSyncAudio,
}: VideoLipSyncAudioDropzoneProps) {
  return (
    <div
      ref={lipSyncAudioDropzoneRef}
      className={`reference-dropzone video-lip-sync-audio-dropzone ${lipSyncAudioPlaybackUrl ? "has-preview" : ""} ${lipSyncAudio.status === "failed" ? "is-failed" : ""} ${
        lipSyncAudioDragActive || lipSyncAudioCanvasTearOutActive ? "is-dragging" : ""
      }`.trim()}
      role="button"
      tabIndex={0}
      onClick={() => lipSyncAudioInputRef.current?.click()}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          lipSyncAudioInputRef.current?.click();
        }
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setLipSyncAudioDragActive(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        setLipSyncAudioDragActive(true);
      }}
      onDragLeave={() => setLipSyncAudioDragActive(false)}
      onDrop={handleLipSyncAudioDrop}
    >
      <span className="dropzone-tag">Voice audio</span>
      {lipSyncAudioPlaybackUrl ? (
        <div className="video-lip-sync-audio-preview" onClick={(event) => event.stopPropagation()}>
          <ReferenceAudioPlayer
            audioId="lip-sync-audio"
            audioUrl={lipSyncAudioPlaybackUrl}
            title={lipSyncAudio.title ?? null}
            durationMs={lipSyncAudio.durationMs}
            showDurationBadge={false}
            playLabel="Play voice audio"
            pauseLabel="Pause voice audio"
            eagerWaveformDecode={false}
          />
          {lipSyncAudio.status === "uploading" ? (
            <div className="video-lip-sync-audio-state">Uploading</div>
          ) : null}
        </div>
      ) : (
        <div className="reference-drop-content video-drop-content">
          <UploadSimple size={24} weight="regular" />
          <p className="reference-drop-title helper-text">Upload voice audio</p>
        </div>
      )}
      {lipSyncAudioPlaybackUrl || lipSyncAudio.status === "failed" ? (
        <button
          type="button"
          className="dropzone-clear"
          onClick={(event) => {
            event.stopPropagation();
            clearLipSyncAudio();
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
