/**
 * Reference Grid stability telemetry controller.
 * Emits threshold-based crash-adjacent signals without increasing render-path work.
 */
import { useEffect, useRef } from "react";
import {
  maybeMarkAiStudioPressureQuarantine,
  reportAiStudioStabilityEvent,
} from "../../logic/aiStudioStabilityTelemetry";
import type { ReferenceGridPerfWatchdogState } from "../../hooks/useReferenceGridPerfWatchdog";

type UseReferenceGridStabilityTelemetryControllerArgs = {
  effectivePerfDegradeLevel: 0 | 1 | 2;
  perfWatchdog: ReferenceGridPerfWatchdogState;
  renderedItemCount: number;
  outputsLength: number;
  archivedOutputsLength: number;
};

/**
 * Reports first render and pressure transitions for production crash forensics.
 */
export const useReferenceGridStabilityTelemetryController = ({
  effectivePerfDegradeLevel,
  perfWatchdog,
  renderedItemCount,
  outputsLength,
  archivedOutputsLength,
}: UseReferenceGridStabilityTelemetryControllerArgs): void => {
  const firstGridCommitReportedRef = useRef(false);
  const previousPressureLevelRef = useRef<0 | 1 | 2 | null>(null);

  useEffect(() => {
    if (firstGridCommitReportedRef.current) return;
    firstGridCommitReportedRef.current = true;
    reportAiStudioStabilityEvent("first_grid_commit", {
      rendered_item_count: renderedItemCount,
      total_item_count: outputsLength,
      archived_item_count: archivedOutputsLength,
      pressure_level: effectivePerfDegradeLevel,
    });
  }, [archivedOutputsLength, effectivePerfDegradeLevel, outputsLength, renderedItemCount]);

  useEffect(() => {
    maybeMarkAiStudioPressureQuarantine({
      level: effectivePerfDegradeLevel,
      longTaskP95Ms: perfWatchdog.longTaskP95Ms,
      maxInputStallMs: perfWatchdog.maxInputStallMs,
      heapUsageRatio: perfWatchdog.heapUsageRatio,
    });

    const previousPressureLevel = previousPressureLevelRef.current;
    previousPressureLevelRef.current = effectivePerfDegradeLevel;
    if (previousPressureLevel === null || previousPressureLevel === effectivePerfDegradeLevel) {
      return;
    }

    const transitionLabel = `${previousPressureLevel}_to_${effectivePerfDegradeLevel}`;

    reportAiStudioStabilityEvent(
      "pressure_level_changed",
      {
        previous_pressure_level: previousPressureLevel,
        pressure_level: effectivePerfDegradeLevel,
        pressure_transition: transitionLabel,
        long_task_p95_ms: perfWatchdog.longTaskP95Ms,
        max_input_stall_ms: perfWatchdog.maxInputStallMs,
        heap_usage_ratio: perfWatchdog.heapUsageRatio,
        total_item_count: outputsLength,
        archived_item_count: archivedOutputsLength,
      },
      {
        message: `ai_studio_stability.pressure_level_changed.${transitionLabel}`,
      }
    );
  }, [
    archivedOutputsLength,
    effectivePerfDegradeLevel,
    outputsLength,
    perfWatchdog.heapUsageRatio,
    perfWatchdog.longTaskP95Ms,
    perfWatchdog.maxInputStallMs,
  ]);
};
