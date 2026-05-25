/**
 * Shared validation helpers for user-defined custom voice names.
 */
export const MAX_CUSTOM_VOICE_NAME_CHARACTERS = 255;

export const CUSTOM_VOICE_NAME_VALIDATION_DETAILS = `voiceName must be between 1 and ${MAX_CUSTOM_VOICE_NAME_CHARACTERS} characters.`;

/**
 * Clamps raw voice-name input so browser and test interactions stay aligned with
 * the durable database constraint for custom voice names.
 */
export const clampCustomVoiceNameInput = (value: string): string =>
  value.slice(0, MAX_CUSTOM_VOICE_NAME_CHARACTERS);

/**
 * Returns the customer-facing validation message when a normalized voice name
 * is empty or exceeds the supported persisted length.
 */
export const validateCustomVoiceName = (value: string | null): string | null => {
  if (!value) return CUSTOM_VOICE_NAME_VALIDATION_DETAILS;
  if (value.length > MAX_CUSTOM_VOICE_NAME_CHARACTERS) {
    return CUSTOM_VOICE_NAME_VALIDATION_DETAILS;
  }
  return null;
};
