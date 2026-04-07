import React from "react";
import { createEmptyElementDraft } from "../constants";
import type { ElementDraft, ElementLibraryItem } from "../types";

const buildDraftFromItem = (item: ElementLibraryItem): ElementDraft => ({
  name: item.name,
  alias: item.alias,
  description: item.description,
  assetType: item.assetType,
  imageReferenceUrls: item.imageReferenceUrls,
  videoReferenceUrl: item.videoReferenceUrl ?? "",
});

export const useElementsManagerDraft = () => {
  const [draft, setDraft] = React.useState<ElementDraft>(createEmptyElementDraft);

  const hydrateDraft = React.useCallback((item: ElementLibraryItem | null) => {
    setDraft(item ? buildDraftFromItem(item) : createEmptyElementDraft());
  }, []);

  const updateDraftField = React.useCallback(
    <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => {
      setDraft((current) => ({ ...current, [field]: value }));
    },
    []
  );

  const resetDraft = React.useCallback(() => {
    setDraft(createEmptyElementDraft());
  }, []);

  return {
    draft,
    hydrateDraft,
    updateDraftField,
    resetDraft,
  };
};
