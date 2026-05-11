/**
 * Canonical camera/viewport scale contract for Expert Edit stage interactions and flatten export.
 * Keeps runtime viewport zoom and submit-time flatten camera clamping in one shared authority.
 */

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const EXPERT_EDIT_CAMERA_SCALE_MIN = 0.97;
export const EXPERT_EDIT_CAMERA_SCALE_MAX = 2;

export const clampExpertEditCameraScale = (value: number) =>
  clampNumber(value, EXPERT_EDIT_CAMERA_SCALE_MIN, EXPERT_EDIT_CAMERA_SCALE_MAX);
