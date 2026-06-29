import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  maybeMarkAiStudioPressureQuarantine,
  reportAiStudioStabilityEvent,
} from "../../../logic/aiStudioStabilityTelemetry";
import { useReferenceGridStabilityTelemetryController } from "../useReferenceGridStabilityTelemetryController";
import type { ReferenceGridPerfWatchdogState } from "../../../hooks/useReferenceGridPerfWatchdog";

vi.mock("../../../logic/aiStudioStabilityTelemetry", () => ({
  maybeMarkAiStudioPressureQuarantine: vi.fn(),
  reportAiStudioStabilityEvent: vi.fn(),
}));

const reportAiStudioStabilityEventMock = vi.mocked(reportAiStudioStabilityEvent);
const maybeMarkAiStudioPressureQuarantineMock = vi.mocked(maybeMarkAiStudioPressureQuarantine);

type HookProps = {
  pressureLevel: 0 | 1 | 2;
};

const perfWatchdog = (
  overrides: Partial<ReferenceGridPerfWatchdogState> = {}
): ReferenceGridPerfWatchdogState => ({
  degradeLevel: 0,
  previewQualityPressureLevel: 0,
  longTaskP95Ms: null,
  maxInputStallMs: 0,
  heapUsageRatio: null,
  sampleCount: 0,
  ...overrides,
});

describe("useReferenceGridStabilityTelemetryController", () => {
  beforeEach(() => {
    reportAiStudioStabilityEventMock.mockClear();
    maybeMarkAiStudioPressureQuarantineMock.mockClear();
  });

  it("uses first-grid telemetry for initial pressure and bounded messages for transitions", () => {
    const { rerender } = renderHook(
      ({ pressureLevel }: HookProps) =>
        useReferenceGridStabilityTelemetryController({
          effectivePerfDegradeLevel: pressureLevel,
          perfWatchdog: perfWatchdog({
            longTaskP95Ms: pressureLevel === 2 ? 120 : null,
            maxInputStallMs: pressureLevel === 2 ? 900 : 0,
          }),
          renderedItemCount: 12,
          outputsLength: 20,
          archivedOutputsLength: 3,
        }),
      {
        initialProps: {
          pressureLevel: 0 as const,
        } as HookProps,
      }
    );

    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith("first_grid_commit", {
      rendered_item_count: 12,
      total_item_count: 20,
      archived_item_count: 3,
      pressure_level: 0,
    });
    expect(reportAiStudioStabilityEventMock).not.toHaveBeenCalledWith(
      "pressure_level_changed",
      expect.anything(),
      expect.anything()
    );

    reportAiStudioStabilityEventMock.mockClear();
    rerender({
      pressureLevel: 2,
    });

    expect(reportAiStudioStabilityEventMock).toHaveBeenCalledWith(
      "pressure_level_changed",
      expect.objectContaining({
        previous_pressure_level: 0,
        pressure_level: 2,
        pressure_transition: "0_to_2",
      }),
      {
        message: "ai_studio_stability.pressure_level_changed.0_to_2",
      }
    );
  });
});
