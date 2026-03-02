/**
 * Chat-mode preference storage helpers.
 * Keeps local-only persistence for AI Studio chat-vs-raw behavior centralized.
 */

export const CHAT_MODE_STORAGE_KEY = "shortpulse.ai_studio.chat_mode";
const LEGACY_RAW_PROMPT_MODE_STORAGE_KEY = "shortpulse.ai_studio.raw_prompt_mode";

const parseStoredBoolean = (value: string | null | undefined): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "off") return false;
  return null;
};

/**
 * Reads chat mode from browser storage.
 * Defaults to ON and falls back to legacy raw-mode storage when present.
 */
export const readChatModeFromStorage = (
  storage: Pick<Storage, "getItem"> | null | undefined
): boolean => {
  if (!storage) return true;

  const chatModeValue = parseStoredBoolean(storage.getItem(CHAT_MODE_STORAGE_KEY));
  if (chatModeValue != null) return chatModeValue;

  const legacyRawPromptModeValue = parseStoredBoolean(
    storage.getItem(LEGACY_RAW_PROMPT_MODE_STORAGE_KEY)
  );
  if (legacyRawPromptModeValue != null) {
    return !legacyRawPromptModeValue;
  }

  return true;
};

/**
 * Persists chat mode to browser storage.
 */
export const writeChatModeToStorage = (
  enabled: boolean,
  storage: Pick<Storage, "setItem"> | null | undefined
): void => {
  if (!storage) return;
  storage.setItem(CHAT_MODE_STORAGE_KEY, enabled ? "1" : "0");
};
