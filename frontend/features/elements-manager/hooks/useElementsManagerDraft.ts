/**
 * Draft-state controller for the local Elements profile shell.
 * Keeps nested reference-set state explicit while mirroring the active set onto flat draft fields.
 */
import React from "react";
import { createDefaultElementReferenceSetState, createEmptyElementDraft } from "../constants";
import type {
  ElementDraft,
  ElementLibraryItem,
  ElementReferenceSet,
  ElementReferenceSetId,
} from "../types";

const buildDraftFromItem = (item: ElementLibraryItem): ElementDraft => {
  const referenceSetState = item.referenceSetState ?? createDefaultElementReferenceSetState();
  const activeSet = referenceSetState.sets[referenceSetState.activeSetId];
  return {
    name: item.name,
    alias: item.alias,
    description: activeSet.description,
    assetType: item.assetType,
    imageReferenceUrls: activeSet.imageReferenceUrls,
    videoReferenceUrl: activeSet.videoReferenceUrl,
    activeReferenceSetId: referenceSetState.activeSetId,
    visibleReferenceSetIds: referenceSetState.tabOrder,
    referenceSetLabels: referenceSetState.tabLabels,
    referenceSets: referenceSetState.sets,
  };
};

const syncActiveReferenceSet = (
  current: ElementDraft,
  nextSetId?: ElementReferenceSetId
): ElementDraft => {
  const activeReferenceSetId = nextSetId ?? current.activeReferenceSetId;
  const activeReferenceSet = current.referenceSets[activeReferenceSetId];
  return {
    ...current,
    activeReferenceSetId,
    description: activeReferenceSet.description,
    imageReferenceUrls: activeReferenceSet.imageReferenceUrls,
    videoReferenceUrl: activeReferenceSet.videoReferenceUrl,
  };
};

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

  const updateActiveReferenceSet = React.useCallback(
    (updater: (currentSet: ElementReferenceSet) => ElementReferenceSet) => {
      setDraft((current) => {
        const nextReferenceSets = {
          ...current.referenceSets,
          [current.activeReferenceSetId]: updater(
            current.referenceSets[current.activeReferenceSetId]
          ),
        };
        return syncActiveReferenceSet({
          ...current,
          referenceSets: nextReferenceSets,
        });
      });
    },
    []
  );

  const setActiveReferenceSet = React.useCallback((setId: ElementReferenceSetId) => {
    setDraft((current) => syncActiveReferenceSet(current, setId));
  }, []);

  const resetDraft = React.useCallback(() => {
    setDraft(createEmptyElementDraft());
  }, []);

  return {
    draft,
    hydrateDraft,
    updateDraftField,
    updateActiveReferenceSet,
    setActiveReferenceSet,
    setDraft,
    resetDraft,
  };
};
