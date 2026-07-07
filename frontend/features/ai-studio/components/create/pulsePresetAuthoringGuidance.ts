/**
 * Shared copy for simple custom Pulse authoring.
 * Custom Pulses persist only label and system instructions; these strings guide that single field.
 */
export const CUSTOM_PULSE_HELPER_TEXT =
  "A custom Pulse is saved system instructions. To make it reusable, describe the job it owns, the inputs it should ask for, and the output it should return.";

export const CUSTOM_PULSE_TEXTAREA_PLACEHOLDER =
  "Tell this Pulse who it is, what it should ask for, how it should respond, and what finished output should look like.";

export const CUSTOM_PULSE_GUIDANCE_ITEMS = [
  "What the Pulse helps with",
  "What it should ask before answering",
  "What kind of finished response or artifact it should produce",
] as const;
