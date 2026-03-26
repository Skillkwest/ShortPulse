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
    window.__shortpulseStyleSourceResolution?.clear();
  });

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
      resolutionStage: "server_copy_fallback",
      resolutionReason: "server copy delivery",
      candidateCount: 3,
      serverCopyAttempted: true,
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
        resolution_stage: "server_copy_fallback",
        resolution_reason: "server_copy_delivery",
        candidate_count: 3,
        server_copy_attempted: true,
      })
    );
  });

  it("captures source-resolution packets on the window debug handle", () => {
    trackStyleSourceResolutionDiagnostic({
      flow: "library_drop",
      outcome: "resolved",
      resolvedSourceKind: "internal",
      internalPayloadPresent: true,
      internalDragTokenPresent: true,
      rawSnapshotSeedCount: 2,
      transferTypes: ["text/reference-drag-token", "text/reference-output-id"],
      referenceOrigin: "ai-studio-reference-grid",
      referenceOutputId: "out-capture",
      referenceMediaId: "media-capture",
      referenceImageIndex: 1,
      referenceSourceSurface: "all-refs",
      referenceUrlKind: "missing",
      referenceRenderUrlKind: "data_image",
      imageUrlKind: "missing",
      plainTextKind: "text",
      resolutionStage: "primary",
      resolutionReason: "payload reference url",
      candidateCount: 1,
      serverCopyAttempted: false,
      errorMessage: "",
    });

    const snapshot = window.__shortpulseStyleSourceResolution?.snapshot() ?? [];
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0]).toEqual(
      expect.objectContaining({
        outcome: "resolved",
        capture_version: "style-source-resolution-v2",
        internal_payload_present: true,
        internal_drag_token_present: true,
        raw_snapshot_seed_count: 2,
        transfer_types: ["text/reference-drag-token", "text/reference-output-id"],
        reference_output_id: "out-capture",
        resolution_reason: "payload_reference_url",
        candidate_count: 1,
        server_copy_attempted: false,
      })
    );
    expect(window.__shortpulseStyleSourceResolution?.latest()).toEqual(snapshot[0]);
    expect(window.__shortpulseStyleSourceResolution?.version).toBe("style-source-resolution-v2");
    window.__shortpulseStyleSourceResolution?.clear();
    expect(window.__shortpulseStyleSourceResolution?.snapshot()).toEqual([]);
  });

  it("preserves deterministic metadata for unresolved internal-source failures", () => {
    trackStyleExtractionOutcome("blocked_source", "library_drop", {
      stage: "preview_source",
      failureClass: "blocked_source",
      classifierReason: "internal_source_unresolved",
      resolutionStage: "primary",
      resolutionReason: "internal source unresolved",
      candidateCount: 0,
      serverCopyAttempted: false,
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
        server_copy_attempted: false,
      })
    );
  });
});
