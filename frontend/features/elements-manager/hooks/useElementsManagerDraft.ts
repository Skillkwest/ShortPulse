/**
 * Draft-state controller for the local Elements profile shell.
 * Owns the flat Elements draft used by the embedded profile editor.
 */
import React from "react";
import { createEmptyElementDraft } from "../constants";
import type { ElementDraft, ElementLibraryItem } from "../types";

const buildDraftFromItem = (item: ElementLibraryItem): ElementDraft => ({
  name: item.name,
  alias: item.alias,
  description: item.description,
  assetType: item.assetType,
  profileImageUrl: item.profileImageUrl,
  profileImageTransform: item.profileImageTransform,
  imageReferenceUrls: item.imageReferenceUrls,
  videoReferenceUrl: item.videoReferenceUrl ?? "",
});

export const useElementsManagerDraft = () => {
  const [draft, setDraft] = React.useState<ElementDraft>(createEmptyElementDraft);

  const hydrateDraft = React.useCallback((item: ElementLibraryItem | null) => {
    setDraft(item ? buildDraftFromItem(item) : createEmptyElementDraft());
  }, []);

  const resetDraft = React.useCallback(() => {
    setDraft(createEmptyElementDraft());
  }, []);

  return {
    draft,
    hydrateDraft,
    setDraft,
    resetDraft,
  };
};
