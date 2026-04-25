/**
 * Elements Manager persistence orchestrator.
 * Exposes high-level draft operations used by the Elements library shell.
 */
export {
  clearElementProfileImage,
  DEFAULT_ELEMENT_NAME,
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
  saveElementManagerDraftSnapshot,
  saveElementProfileImageAdjustments,
  uploadElementProfileImage,
} from "./elementsManagerPersistenceCore";
export type {
  ElementManagerDraftSnapshot,
  ElementsManagerListItem,
  SaveElementManagerDraftInput,
} from "./elementsManagerPersistenceCore";
