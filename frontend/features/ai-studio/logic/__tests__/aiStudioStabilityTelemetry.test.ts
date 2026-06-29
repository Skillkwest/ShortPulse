import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportAppError } from "../../../../lib/appErrorReporter";
import {
  applyAiStudioPressureQuarantineLevel,
  clearAiStudioPressureQuarantineForTests,
  maybeMarkAiStudioPressureQuarantine,
  reportAiStudioStabilityEvent,
  resolveAiStudioPressureQuarantineLevel,
} from "../aiStudioStabilityTelemetry";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

const reportAppErrorMock = vi.mocked(reportAppError);

describe("aiStudioStabilityTelemetry", () => {
  beforeEach(() => {
    reportAppErrorMock.mockClear();
    clearAiStudioPressureQuarantineForTests();
  });

  afterEach(() => {
    clearAiStudioPressureQuarantineForTests();
  });

  it("reports medium-severity telemetry-only stability events", () => {
    reportAiStudioStabilityEvent("session_started", {
      project_id_present: true,
    });

    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.ai_studio.stability.session_started",
        scope: "app",
        severity: "medium",
        message: "ai_studio_stability.session_started",
        metadata: {
          project_id_present: true,
        },
      })
    );
  });

  it("does not mark quarantine below critical pressure", () => {
    const marked = maybeMarkAiStudioPressureQuarantine({
      level: 1,
      longTaskP95Ms: 140,
      maxInputStallMs: 900,
      heapUsageRatio: 0.9,
    });

    expect(marked).toBe(false);
    expect(resolveAiStudioPressureQuarantineLevel()).toBe(0);
  });

  it("marks level-2 quarantine for severe input stalls", () => {
    const marked = maybeMarkAiStudioPressureQuarantine({
      level: 2,
      longTaskP95Ms: 60,
      maxInputStallMs: 900,
      heapUsageRatio: 0.4,
    });

    expect(marked).toBe(true);
    expect(resolveAiStudioPressureQuarantineLevel()).toBe(2);
    expect(applyAiStudioPressureQuarantineLevel(0)).toBe(2);
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.ai_studio.stability.pressure_quarantine_set",
        severity: "medium",
      })
    );
  });
});
