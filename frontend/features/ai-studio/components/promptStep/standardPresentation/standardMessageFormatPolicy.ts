/**
 * Standard message format policy.
 * Maps Standard message tone to the correct rich-text rendering mode.
 */
export type StandardMessageTone = "assistant" | "user";
export type StandardMessageFormatMode = "basic" | "standard_rich";

export const resolveStandardMessageFormatMode = (
  tone: StandardMessageTone
): StandardMessageFormatMode => (tone === "assistant" ? "standard_rich" : "basic");
