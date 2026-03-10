/**
 * Shared selected-character persistence helpers.
 * Stores the user's current character selection and emits sync events across surfaces.
 */

import {
  buildUserScopedStorageKey,
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
} from "./userScopedLocalStorage";

const SELECTED_CHARACTER_STORAGE_KEY_V2 = "shortpulse.character_manager.selected_character_id.v2";
const SELECTED_CHARACTER_STORAGE_KEY_LEGACY =
  "shortpulse.character_manager.selected_character_id.v1";
const SELECTED_CHARACTER_CHANGE_EVENT = "shortpulse:character-selection-changed";

type SelectionChangeDetail = {
  characterId: string | null;
  userId: string | null;
};

type SelectedCharacterPersistenceOptions = {
  userId?: string | null;
};

const normalizeCharacterId = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeUserId = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const resolveStorageKeys = (options?: SelectedCharacterPersistenceOptions) => {
  const userId = normalizeUserId(options?.userId);
  return {
    userId,
    primaryKey: buildUserScopedStorageKey(SELECTED_CHARACTER_STORAGE_KEY_V2, userId),
    legacyKey: userId ? null : SELECTED_CHARACTER_STORAGE_KEY_LEGACY,
  };
};

const readStorageValue = (options?: SelectedCharacterPersistenceOptions): string | null => {
  const { primaryKey, legacyKey } = resolveStorageKeys(options);
  const primary = normalizeCharacterId(readLocalStorageValue(primaryKey));
  if (primary) return primary;
  if (!legacyKey) return null;
  return normalizeCharacterId(readLocalStorageValue(legacyKey));
};

const writeStorageValue = (
  characterId: string | null,
  options?: SelectedCharacterPersistenceOptions
): void => {
  const { primaryKey } = resolveStorageKeys(options);
  if (characterId) {
    writeLocalStorageValue(primaryKey, characterId);
    return;
  }
  removeLocalStorageValue(primaryKey);
};

const shouldHandleCustomEvent = (
  eventUserId: string | null | undefined,
  options?: SelectedCharacterPersistenceOptions
): boolean => {
  const { userId } = resolveStorageKeys(options);
  return normalizeUserId(eventUserId) === userId;
};

const shouldHandleStorageEvent = (
  changedKey: string | null,
  options?: SelectedCharacterPersistenceOptions
): boolean => {
  if (!changedKey) return false;
  const { primaryKey, legacyKey } = resolveStorageKeys(options);
  return changedKey === primaryKey || (legacyKey !== null && changedKey === legacyKey);
};

const buildEventDetail = (
  characterId: string | null,
  options?: SelectedCharacterPersistenceOptions
): SelectionChangeDetail => {
  const { userId } = resolveStorageKeys(options);
  return {
    characterId,
    userId,
  };
};

/**
 * Read the persisted selected character id.
 */
export const readPersistedSelectedCharacterId = (
  options?: SelectedCharacterPersistenceOptions
): string | null => readStorageValue(options);

/**
 * Persist the selected character id and notify listeners when it changes.
 */
export const persistSelectedCharacterId = (
  characterId: string | null,
  options?: SelectedCharacterPersistenceOptions
): void => {
  if (typeof window === "undefined") return;
  const normalized = normalizeCharacterId(characterId);
  const previous = readStorageValue(options);
  if (previous === normalized) return;
  writeStorageValue(normalized, options);
  window.dispatchEvent(
    new CustomEvent<SelectionChangeDetail>(SELECTED_CHARACTER_CHANGE_EVENT, {
      detail: buildEventDetail(normalized, options),
    })
  );
};

/**
 * Subscribe to selected-character changes from same-tab and cross-tab updates.
 */
export const subscribeToSelectedCharacterId = (
  onChange: (characterId: string | null) => void,
  options?: SelectedCharacterPersistenceOptions
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<SelectionChangeDetail>).detail;
    if (!shouldHandleCustomEvent(detail?.userId, options)) return;
    onChange(normalizeCharacterId(detail?.characterId ?? null));
  };
  const handleStorageEvent = (event: StorageEvent) => {
    if (!shouldHandleStorageEvent(event.key, options)) return;
    onChange(normalizeCharacterId(event.newValue));
  };

  window.addEventListener(SELECTED_CHARACTER_CHANGE_EVENT, handleCustomEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  return () => {
    window.removeEventListener(SELECTED_CHARACTER_CHANGE_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener("storage", handleStorageEvent);
  };
};
