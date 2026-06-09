/**
 * Canvas audio-card wrapper.
 * Reuses the shared Reference Grid audio player while preserving canvas drag/select semantics.
 */
import React from "react";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import type { CanvasAudioItem } from "./canvasTypes";

const isInteractiveAudioTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      ".reference-card-audio-play, .reference-card-audio-waveform-control, .reference-card-audio-download"
    )
  );
};

/**
 * Renders one canvas audio scene item with the shared Reference Grid audio UI.
 */
export function CanvasAudioCard({
  item,
  onMediaError,
}: {
  item: CanvasAudioItem;
  onMediaError?: () => void;
}) {
  const title = item.title?.trim() || "audio reference";

  return (
    <div
      className="canvas-scene-item__audio-frame"
      onPointerDownCapture={(event) => {
        if (isInteractiveAudioTarget(event.target)) {
          event.stopPropagation();
        }
      }}
      onPointerUpCapture={(event) => {
        if (isInteractiveAudioTarget(event.target)) {
          event.stopPropagation();
        }
      }}
    >
      <div className="reference-card has-audio canvas-reference-card">
        <ReferenceAudioPlayer
          audioId={item.id}
          audioUrl={item.audioUrl}
          backgroundImageUrl={item.companionArtUrl ?? null}
          audioSourceMode={item.audioSourceMode ?? null}
          durationMs={item.durationMs ?? null}
          waveformPeaks={item.waveformPeaks ?? null}
          playLabel={`Play ${title}`}
          pauseLabel={`Pause ${title}`}
          onError={onMediaError}
          eagerWaveformDecode={false}
        />
      </div>
    </div>
  );
}
