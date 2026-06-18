/**
 * Right-rail layout snapshot tests.
 * Verifies the project-durable layout schema defaults, sanitization, and signatures.
 */
import { describe, expect, it } from "vitest";
import {
  createDefaultRightRailLayout,
  createRightRailLayoutSignature,
  sanitizeRightRailLayoutSnapshot,
} from "../rightRailLayout";

describe("rightRailLayout", () => {
  it("creates the shipped default global right-rail layout", () => {
    expect(createDefaultRightRailLayout()).toEqual({
      schemaVersion: 1,
      panels: {
        canvas: false,
        quickSlot: true,
        referenceGrid: true,
      },
      splits: {
        canvasInventoryTopRatio: null,
        quickSlotReferenceTopRatio: null,
      },
    });
  });

  it("sanitizes unknown values and clamps split ratios", () => {
    expect(
      sanitizeRightRailLayoutSnapshot({
        schemaVersion: 99,
        panels: {
          canvas: true,
          quickSlot: "nope",
          referenceGrid: false,
        },
        splits: {
          shellLeftRatio: -1,
          canvasInventoryTopRatio: 2,
          quickSlotReferenceTopRatio: 0.4,
        },
      })
    ).toEqual({
      schemaVersion: 1,
      panels: {
        canvas: true,
        quickSlot: true,
        referenceGrid: false,
      },
      splits: {
        canvasInventoryTopRatio: 0.99,
        quickSlotReferenceTopRatio: 0.4,
      },
    });
  });

  it("builds stable signatures from sanitized values", () => {
    expect(
      createRightRailLayoutSignature({
        panels: {
          canvas: true,
          quickSlot: false,
          referenceGrid: true,
        },
        splits: {
          shellLeftRatio: 0.5,
          canvasInventoryTopRatio: Number.NaN,
          quickSlotReferenceTopRatio: 0.25,
        },
      })
    ).toBe(
      JSON.stringify({
        schemaVersion: 1,
        panels: {
          canvas: true,
          quickSlot: false,
          referenceGrid: true,
        },
        splits: {
          canvasInventoryTopRatio: null,
          quickSlotReferenceTopRatio: 0.25,
        },
      })
    );
  });
});
