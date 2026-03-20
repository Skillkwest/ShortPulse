/**
 * Unit tests for the shared Expert Edit camera scale contract.
 */
import { describe, expect, it } from "vitest";
import {
  EXPERT_EDIT_CAMERA_SCALE_MAX,
  EXPERT_EDIT_CAMERA_SCALE_MIN,
  clampExpertEditCameraScale,
} from "../expertEditCameraContract";

describe("expertEditCameraContract", () => {
  it("exports the canonical camera scale bounds", () => {
    expect(EXPERT_EDIT_CAMERA_SCALE_MIN).toBe(0.5);
    expect(EXPERT_EDIT_CAMERA_SCALE_MAX).toBe(4);
  });

  it("clamps scales to canonical camera bounds", () => {
    expect(clampExpertEditCameraScale(0.1)).toBe(EXPERT_EDIT_CAMERA_SCALE_MIN);
    expect(clampExpertEditCameraScale(1.75)).toBe(1.75);
    expect(clampExpertEditCameraScale(9)).toBe(EXPERT_EDIT_CAMERA_SCALE_MAX);
  });
});
