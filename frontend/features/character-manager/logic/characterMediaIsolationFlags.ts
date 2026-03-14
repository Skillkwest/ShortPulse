/**
 * Runtime flags for Character Panel Media Isolation V2 rollout.
 * Keeps writes/reads gated during transition to character-owned media assets.
 */

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const readRuntimeFlag = (publicKey: string, serverKey: string, fallback: boolean): boolean =>
  parseBoolean(process.env[publicKey] ?? process.env[serverKey], fallback);

/**
 * Enables Character Media V2 writes (character_media_assets-first persistence).
 */
export const isCharacterMediaV2WritesEnabled = (): boolean =>
  readRuntimeFlag(
    "NEXT_PUBLIC_CHARACTER_MEDIA_V2_WRITES_ENABLED",
    "SHORTPULSE_CHARACTER_MEDIA_V2_WRITES_ENABLED",
    false
  );

/**
 * Enables Character Media V2 reads (character_media_assets-first lookup).
 */
export const isCharacterMediaV2ReadsEnabled = (): boolean =>
  readRuntimeFlag(
    "NEXT_PUBLIC_CHARACTER_MEDIA_V2_READS_ENABLED",
    "SHORTPULSE_CHARACTER_MEDIA_V2_READS_ENABLED",
    false
  );
