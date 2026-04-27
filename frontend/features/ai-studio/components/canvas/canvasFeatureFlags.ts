/**
 * Feature flags for the shared AI Studio canvas workspace.
 * Keeps rollout controls local to the canvas subsystem.
 */

export const AI_STUDIO_CANVAS_TEXT_RESIZE_ENABLED =
  process.env.NEXT_PUBLIC_AI_STUDIO_CANVAS_TEXT_RESIZE_ENABLED !== "false";
