/**
 * Autoplay event controller for Reference Grid cards.
 * Keeps autoplay start/stop telemetry handlers out of ReferenceCanvas render composition.
 */
import { useCallback, type MutableRefObject } from "react";
import { logMediaPerf } from "../../../../lib/mediaPerfTelemetry";

type UseReferenceGridAutoplayEventControllerArgs = {
  autoplayingIdsRef: MutableRefObject<Set<string>>;
  renderedItemCount: number;
  outputsLength: number;
};

type UseReferenceGridAutoplayEventControllerResult = {
  handleAutoplayStarted: (id: string) => void;
  handleAutoplayStopped: (id: string) => void;
};

/**
 * Returns stable autoplay event handlers with unchanged telemetry payload semantics.
 */
export const useReferenceGridAutoplayEventController = ({
  autoplayingIdsRef,
  renderedItemCount,
  outputsLength,
}: UseReferenceGridAutoplayEventControllerArgs): UseReferenceGridAutoplayEventControllerResult => {
  const handleAutoplayStarted = useCallback(
    (id: string) => {
      if (autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.add(id);
      logMediaPerf("media.grid.autoplay.started", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputsLength,
      });
    },
    [autoplayingIdsRef, outputsLength, renderedItemCount]
  );

  const handleAutoplayStopped = useCallback(
    (id: string) => {
      if (!autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.delete(id);
      logMediaPerf("media.grid.autoplay.stopped", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputsLength,
      });
    },
    [autoplayingIdsRef, outputsLength, renderedItemCount]
  );

  return {
    handleAutoplayStarted,
    handleAutoplayStopped,
  };
};
