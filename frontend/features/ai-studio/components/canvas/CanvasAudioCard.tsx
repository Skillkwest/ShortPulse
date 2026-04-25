/**
 * Canvas audio-card wrapper.
 * Reuses the shared Reference Grid audio player while preserving canvas drag/select semantics.
 */
import React from "react";
import { ReferenceAudioPlayer } from "../shared/ReferenceAudioPlayer";
import type { CanvasAudioItem } from "./canvasTypes";

const isInteractiveAudioTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest(".reference-card-audio-play"));
};

/**
 * Renders one canvas audio scene item with the shared Reference Grid audio UI.
 */
export function CanvasAudioCard({ item }: { item: CanvasAudioItem }) {
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
      <ReferenceAudioPlayer
        audioId={item.id}
        audioUrl={item.audioUrl}
        durationMs={item.durationMs ?? null}
        waveformPeaks={item.waveformPeaks ?? null}
        playLabel={`Play ${title}`}
        pauseLabel={`Pause ${title}`}
        eagerWaveformDecode={false}
      />
    </div>
  );
}
