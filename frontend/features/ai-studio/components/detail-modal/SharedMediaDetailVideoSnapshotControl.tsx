import React from "react";
import { Camera } from "phosphor-react";
import type {
  SharedMediaDetailVideoSnapshotErrorHandler,
  SharedMediaDetailVideoSnapshotHandler,
} from "./detailModalPlatformTypes";

type SharedMediaDetailVideoSnapshotControlProps = {
  videoRef: React.RefObject<HTMLVideoElement>;
  filenameHint: string;
  onSnapshotVideoFrame?: SharedMediaDetailVideoSnapshotHandler;
  onSnapshotVideoFrameError?: SharedMediaDetailVideoSnapshotErrorHandler;
};

/**
 * Stage-level video frame snapshot control for detail modals.
 * Captures through the canonical snapshot handler and confirms successful saves in-place.
 */
export function SharedMediaDetailVideoSnapshotControl({
  videoRef,
  filenameHint,
  onSnapshotVideoFrame,
  onSnapshotVideoFrameError,
}: SharedMediaDetailVideoSnapshotControlProps) {
  const [isSnapshotCapturing, setIsSnapshotCapturing] = React.useState(false);
  const [isSnapshotSaved, setIsSnapshotSaved] = React.useState(false);
  const savedFeedbackTimerRef = React.useRef<number | null>(null);

  const clearSavedFeedbackTimer = React.useCallback(() => {
    if (savedFeedbackTimerRef.current === null || typeof window === "undefined") return;
    window.clearTimeout(savedFeedbackTimerRef.current);
    savedFeedbackTimerRef.current = null;
  }, []);

  React.useEffect(() => clearSavedFeedbackTimer, [clearSavedFeedbackTimer]);

  const showSavedFeedback = React.useCallback(() => {
    if (typeof window === "undefined") return;
    clearSavedFeedbackTimer();
    setIsSnapshotSaved(true);
    savedFeedbackTimerRef.current = window.setTimeout(() => {
      setIsSnapshotSaved(false);
      savedFeedbackTimerRef.current = null;
    }, 1600);
  }, [clearSavedFeedbackTimer]);

  const handleSnapshotVideoFrame = React.useCallback(() => {
    if (!onSnapshotVideoFrame || isSnapshotCapturing) return;
    const video = videoRef.current;
    if (!video) {
      onSnapshotVideoFrameError?.("Video frame is not ready yet.");
      return;
    }
    setIsSnapshotSaved(false);
    setIsSnapshotCapturing(true);
    void Promise.resolve(onSnapshotVideoFrame(video, filenameHint))
      .then(() => {
        showSavedFeedback();
      })
      .catch((error) => {
        onSnapshotVideoFrameError?.(
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : "Unable to capture that video frame."
        );
      })
      .finally(() => {
        setIsSnapshotCapturing(false);
      });
  }, [
    filenameHint,
    isSnapshotCapturing,
    onSnapshotVideoFrame,
    onSnapshotVideoFrameError,
    showSavedFeedback,
    videoRef,
  ]);

  if (!onSnapshotVideoFrame) return null;

  return (
    <div className="art-stage-snapshot-control" data-testid="detail-video-snapshot-control">
      {isSnapshotSaved ? (
        <span className="art-stage-snapshot-status" role="status" aria-live="polite">
          Snapshot saved
        </span>
      ) : null}
      <button
        type="button"
        className="art-stage-snapshot-button"
        onClick={handleSnapshotVideoFrame}
        disabled={isSnapshotCapturing}
        aria-label="Frame-shot"
        title="Frame-shot"
      >
        <Camera size={15} weight="bold" aria-hidden />
        <span>{isSnapshotCapturing ? "Saving" : "Frame-shot"}</span>
      </button>
    </div>
  );
}
