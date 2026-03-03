/**
 * Unit coverage for reference-grid adaptive preview routing semantics.
 */
import { describe, expect, it } from "vitest";
import { isReferenceGridAdaptivePreviewRoutingEnabled } from "../referenceGridAdaptivePreview";

describe("referenceGridAdaptivePreview", () => {
  it("returns true only when both routing and quality flags are true", () => {
    expect(
      isReferenceGridAdaptivePreviewRoutingEnabled({
        adaptivePreviewEnabled: true,
        adaptivePreviewQualityEnabled: true,
      })
    ).toBe(true);
    expect(
      isReferenceGridAdaptivePreviewRoutingEnabled({
        adaptivePreviewEnabled: false,
        adaptivePreviewQualityEnabled: true,
      })
    ).toBe(false);
    expect(
      isReferenceGridAdaptivePreviewRoutingEnabled({
        adaptivePreviewEnabled: true,
        adaptivePreviewQualityEnabled: false,
      })
    ).toBe(false);
    expect(
      isReferenceGridAdaptivePreviewRoutingEnabled({
        adaptivePreviewEnabled: false,
        adaptivePreviewQualityEnabled: false,
      })
    ).toBe(false);
  });
});
