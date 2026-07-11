import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reportAppError } from "../../../../lib/appErrorReporter";
import { reportBrowserSessionHealthEvent } from "../../../../lib/browserSessionHealth";
import {
  applyAiStudioPressureQuarantineLevel,
  clearAiStudioPressureQuarantineForTests,
  installAiStudioCrashEvidenceHandle,
  maybeMarkAiStudioPressureQuarantine,
  readAiStudioCrashEvidenceSnapshot,
  reportAiStudioStabilityEvent,
  resolveAiStudioPressureQuarantineLevel,
} from "../aiStudioStabilityTelemetry";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));
vi.mock("../../../../lib/browserSessionHealth", () => ({
  reportBrowserSessionHealthEvent: vi.fn(),
}));

const reportAppErrorMock = vi.mocked(reportAppError);
const reportBrowserSessionHealthEventMock = vi.mocked(reportBrowserSessionHealthEvent);

describe("aiStudioStabilityTelemetry", () => {
  beforeEach(() => {
    reportAppErrorMock.mockClear();
    reportBrowserSessionHealthEventMock.mockClear();
    clearAiStudioPressureQuarantineForTests();
    window.history.pushState(null, "", "/");
  });

  afterEach(() => {
    clearAiStudioPressureQuarantineForTests();
    delete (window as { __shortpulseAiStudioCrashEvidence?: unknown })
      .__shortpulseAiStudioCrashEvidence;
    window.history.pushState(null, "", "/");
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
      heapLimitUsageRatio: 0.9,
    });

    expect(marked).toBe(false);
    expect(resolveAiStudioPressureQuarantineLevel()).toBe(0);
  });

  it("does not quarantine a small heap solely because its allocated segment is full", () => {
    const marked = maybeMarkAiStudioPressureQuarantine({
      level: 2,
      longTaskP95Ms: 40,
      maxInputStallMs: 100,
      heapUsageRatio: 0.94,
      heapLimitUsageRatio: 0.004,
    });

    expect(marked).toBe(false);
    expect(resolveAiStudioPressureQuarantineLevel()).toBe(0);
  });

  it("sends explicit used-to-total evidence without the ambiguous legacy ratio", () => {
    reportAiStudioStabilityEvent("pressure_level_changed", {
      heap_usage_ratio: 0.91,
      pressure_level: 2,
    });

    expect(reportBrowserSessionHealthEventMock).toHaveBeenCalledWith(
      "pressure_snapshot",
      expect.objectContaining({
        heap_used_to_total_ratio: 0.91,
        pressure_level: 2,
      })
    );
    expect(reportBrowserSessionHealthEventMock.mock.calls[0]?.[1]).not.toHaveProperty(
      "heap_usage_ratio"
    );
  });

  it("marks level-2 quarantine for severe input stalls", () => {
    const marked = maybeMarkAiStudioPressureQuarantine({
      level: 2,
      longTaskP95Ms: 60,
      maxInputStallMs: 900,
      heapUsageRatio: 0.4,
      heapLimitUsageRatio: 0.4,
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

  it("exposes local crash evidence without sending telemetry", () => {
    window.history.pushState(null, "", "/ai-studio?perfAuditRuntime=1");
    maybeMarkAiStudioPressureQuarantine({
      level: 2,
      longTaskP95Ms: 120,
      maxInputStallMs: 100,
      heapUsageRatio: 0.4,
      heapLimitUsageRatio: 0.4,
    });
    reportAppErrorMock.mockClear();

    const cleanup = installAiStudioCrashEvidenceHandle();
    const evidenceWindow = window as {
      __shortpulseAiStudioCrashEvidence?: {
        snapshot: typeof readAiStudioCrashEvidenceSnapshot;
      };
    };
    const snapshot = evidenceWindow.__shortpulseAiStudioCrashEvidence?.snapshot();

    expect(snapshot).toEqual(
      expect.objectContaining({
        path: "/ai-studio",
        search: "?perfAuditRuntime=1",
        pressureQuarantine: expect.objectContaining({
          level: 2,
          reason: "long_task",
        }),
        resources: expect.objectContaining({
          total: expect.any(Number),
          fetch: expect.any(Number),
          api: expect.any(Number),
        }),
        dom: expect.objectContaining({
          nodes: expect.any(Number),
          extensionRoots: expect.any(Number),
        }),
      })
    );
    expect(reportAppErrorMock).not.toHaveBeenCalled();

    cleanup();
    expect(evidenceWindow.__shortpulseAiStudioCrashEvidence).toBeUndefined();
  });
});
