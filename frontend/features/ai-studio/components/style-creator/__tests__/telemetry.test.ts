/**
 * Telemetry contract tests for styles-library extraction outcomes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { reportAppErrorMock } = vi.hoisted(() => ({
  reportAppErrorMock: vi.fn(),
}));

vi.mock("../../../../../lib/appErrorReporter", () => ({
  reportAppError: reportAppErrorMock,
}));

import { trackStyleExtractionOutcome, trackStyleSourceResolutionDiagnostic } from "../telemetry";

describe("style-creator telemetry", () => {
  beforeEach(() => {
    reportAppErrorMock.mockClear();
  });

  it("emits normalized resolution metadata for preview-source failures", () => {
    trackStyleExtractionOutcome("blocked_source", "library_drop", {
      stage: "preview_source",
      failureClass: "blocked_source",
      classifierReason: "Network request failed",
      resolutionStage: "primary",
      resolutionReason: "network request failed",
      candidateCount: 4,
      errorMessage: "blocked-style-image-source",
    });

    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAppErrorMock.mock.calls[0]?.[0];
    expect(payload?.metadata).toEqual(
      expect.objectContaining({
        stage: "preview_source",
        failure_class: "blocked_source",
        classifier_reason: "network_request_failed",
        resolution_stage: "primary",
        resolution_reason: "network_request_failed",
        candidate_count: 4,
      })
    );
  });

  it("emits source-resolution diagnostics with normalized packet metadata", () => {
    trackStyleSourceResolutionDiagnostic({
      flow: "library_drop",
      outcome: "blocked_source",
      resolvedSourceKind: "internal",
      internalPayloadPresent: true,
      internalDragTokenPresent: true,
      rawSnapshotSeedCount: 4,
      transferTypes: ["text/reference-url", "text/reference-output-id", "text/plain"],
      referenceOrigin: "ai-studio-reference-grid",
      referenceOutputId: "out-123",
      referenceMediaId: "media-123",
      referenceImageIndex: 0,
      referenceSourceSurface: "all-refs",
      referenceUrlKind: "same_origin_next_image",
      referenceRenderUrlKind: "same_origin_url",
      imageUrlKind: "missing",
      plainTextKind: "text",
      resolutionStage: "primary",
      resolutionReason: "network request failed",
      candidateCount: 3,
      errorMessage: "blocked-style-image-source",
    });

    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAppErrorMock.mock.calls[0]?.[0];
    expect(payload?.source).toBe("telemetry.ai_studio.style_source_resolution");
    expect(payload?.message).toBe("style_source_resolution.blocked_source");
    expect(payload?.metadata).toEqual(
      expect.objectContaining({
        telemetry_family: "style_source_resolution",
        flow: "library_drop",
        outcome: "blocked_source",
        resolved_source_kind: "internal",
        internal_payload_present: true,
        internal_drag_token_present: true,
        raw_snapshot_seed_count: 4,
        transfer_types: ["text/reference-url", "text/reference-output-id", "text/plain"],
        reference_origin: "ai-studio-reference-grid",
        reference_output_id: "out-123",
        reference_media_id: "media-123",
        reference_image_index: 0,
        reference_source_surface: "all-refs",
        reference_url_kind: "same_origin_next_image",
        reference_render_url_kind: "same_origin_url",
        image_url_kind: "missing",
        plain_text_kind: "text",
        resolution_stage: "primary",
        resolution_reason: "network_request_failed",
        candidate_count: 3,
      })
    );
  });

  it("preserves deterministic metadata for unresolved internal-source failures", () => {
    trackStyleExtractionOutcome("blocked_source", "library_drop", {
      stage: "preview_source",
      failureClass: "blocked_source",
      classifierReason: "internal_source_unresolved",
      resolutionStage: "primary",
      resolutionReason: "internal source unresolved",
      candidateCount: 0,
      errorMessage: "blocked-style-image-source",
    });

    expect(reportAppErrorMock).toHaveBeenCalledTimes(1);
    const payload = reportAppErrorMock.mock.calls[0]?.[0];
    expect(payload?.metadata).toEqual(
      expect.objectContaining({
        stage: "preview_source",
        failure_class: "blocked_source",
        classifier_reason: "internal_source_unresolved",
        resolution_stage: "primary",
        resolution_reason: "internal_source_unresolved",
        candidate_count: 0,
      })
    );
  });
});
