/**
 * Elements Manager persistence orchestrator.
 * Exposes high-level draft operations used by the Elements library shell.
 */
export {
  clearElementProfileImage,
  createElementDraftRow,
  DEFAULT_ELEMENT_NAME,
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraftSnapshot,
  saveElementProfileImageAdjustments,
  uploadElementProfileImage,
} from "./elementsManagerPersistenceCore";
export type {
  ElementManagerDraftSnapshot,
  ElementsManagerListItem,
} from "./elementsManagerPersistenceCore";
