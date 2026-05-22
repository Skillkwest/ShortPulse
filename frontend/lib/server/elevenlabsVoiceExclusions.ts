/**
 * Canonical exclusion contract for ElevenLabs voices that must never surface in
 * the ShortPulse voice library, regardless of source (provider catalog or saved
 * user preferences).
 */
export const EXCLUDED_ELEVENLABS_VOICE_IDS = ["TX3LPaxmHKxFdv7VOQHJ"] as const;

const EXCLUDED_ELEVENLABS_VOICE_ID_SET = new Set(
  EXCLUDED_ELEVENLABS_VOICE_IDS.map((voiceId) => voiceId.trim().toLowerCase())
);

/**
 * Returns true when the supplied ElevenLabs voice id is blocked from appearing
 * anywhere in the ShortPulse voice picker.
 */
export const isExcludedElevenLabsVoiceId = (voiceId: string | null | undefined): boolean =>
  typeof voiceId === "string" && EXCLUDED_ELEVENLABS_VOICE_ID_SET.has(voiceId.trim().toLowerCase());
