/**
 * Telemetry contract tests for styles-library extraction outcomes.
 */
import { describe, expect, it, vi } from "vitest";

const { reportAppErrorMock } = vi.hoisted(() => ({
  reportAppErrorMock: vi.fn(),
}));

vi.mock("../../../../../lib/appErrorReporter", () => ({
  reportAppError: reportAppErrorMock,
}));

import { trackStyleExtractionOutcome } from "../telemetry";

describe("style-creator telemetry", () => {
  it("emits normalized resolution metadata for preview-source failures", () => {
    trackStyleExtractionOutcome("blocked_source", "library_drop", {
      stage: "preview_source",
      failureClass: "blocked_source",
      classifierReason: "Network request failed",
      resolutionStage: "server_copy_fallback",
      resolutionReason: "server copy delivery",
      candidateCount: 4,
      serverCopyAttempted: true,
      errorMessage: "blocked-style-image-source",
    });

    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAppErrorMock.mock.calls[0]?.[0];
    expect(payload?.metadata).toEqual(
      expect.objectContaining({
        stage: "preview_source",
        failure_class: "blocked_source",
        classifier_reason: "network_request_failed",
        resolution_stage: "server_copy_fallback",
        resolution_reason: "server_copy_delivery",
        candidate_count: 4,
        server_copy_attempted: true,
      })
    );
  });
});
