/**
 * Shared selected-character persistence helpers.
 * Stores the user's current character selection and emits sync events across surfaces.
 */

const SELECTED_CHARACTER_STORAGE_KEY = "shortpulse.character_manager.selected_character_id.v1";
const SELECTED_CHARACTER_CHANGE_EVENT = "shortpulse:character-selection-changed";

type SelectionChangeDetail = {
  characterId: string | null;
};

const normalizeCharacterId = (value: string | null | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readStorageValue = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return normalizeCharacterId(window.localStorage.getItem(SELECTED_CHARACTER_STORAGE_KEY));
  } catch {
    return null;
  }
};

const writeStorageValue = (characterId: string | null): void => {
  if (typeof window === "undefined") return;
  try {
    if (characterId) {
      window.localStorage.setItem(SELECTED_CHARACTER_STORAGE_KEY, characterId);
      return;
    }
    window.localStorage.removeItem(SELECTED_CHARACTER_STORAGE_KEY);
  } catch {
    // Ignore storage write failures so selection remains usable in-memory.
  }
};

/**
 * Read the persisted selected character id.
 */
export const readPersistedSelectedCharacterId = (): string | null => readStorageValue();

/**
 * Persist the selected character id and notify listeners when it changes.
 */
export const persistSelectedCharacterId = (characterId: string | null): void => {
  if (typeof window === "undefined") return;
  const normalized = normalizeCharacterId(characterId);
  const previous = readStorageValue();
  if (previous === normalized) return;
  writeStorageValue(normalized);
  window.dispatchEvent(
    new CustomEvent<SelectionChangeDetail>(SELECTED_CHARACTER_CHANGE_EVENT, {
      detail: {
        characterId: normalized,
      },
    })
  );
};

/**
 * Subscribe to selected-character changes from same-tab and cross-tab updates.
 */
export const subscribeToSelectedCharacterId = (
  onChange: (characterId: string | null) => void
): (() => void) => {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (event: Event) => {
    const detail = (event as CustomEvent<SelectionChangeDetail>).detail;
    onChange(normalizeCharacterId(detail?.characterId ?? null));
  };
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key !== SELECTED_CHARACTER_STORAGE_KEY) return;
    onChange(normalizeCharacterId(event.newValue));
  };

  window.addEventListener(SELECTED_CHARACTER_CHANGE_EVENT, handleCustomEvent as EventListener);
  window.addEventListener("storage", handleStorageEvent);
  return () => {
    window.removeEventListener(SELECTED_CHARACTER_CHANGE_EVENT, handleCustomEvent as EventListener);
    window.removeEventListener("storage", handleStorageEvent);
  };
};
