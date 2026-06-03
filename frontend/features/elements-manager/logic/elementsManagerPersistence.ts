/**
 * Elements Manager persistence orchestrator.
 * Exposes high-level draft operations used by the Elements library shell.
 */
export {
  DEFAULT_ELEMENT_NAME,
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
  saveElementManagerDraftSnapshot,
} from "./elementsManagerPersistenceCore";
export type {
  ElementManagerDraftSnapshot,
  ElementsManagerListItem,
  SaveElementManagerDraftInput,
} from "./elementsManagerPersistenceCore";
