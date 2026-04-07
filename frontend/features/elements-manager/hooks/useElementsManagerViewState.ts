/**
 * View-state controller for the Elements library panel.
 * Mirrors the embedded Character UX with local-only live editing and delete flows.
 */
import React from "react";
import {
  ELEMENT_REFERENCE_SET_IDS,
  MAX_ELEMENT_REFERENCE_SET_TAB_COUNT,
  createDefaultElementReferenceSetState,
  createEmptyElementDraft,
  createMockElementsLibrary,
} from "../constants";
import type {
  ElementDraft,
  ElementLibraryItem,
  ElementsWorkflowTab,
  ElementReferenceSetId,
} from "../types";
import { useElementsManagerDraft } from "./useElementsManagerDraft";

const createIdFromName = (name: string): string =>
  `element-${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `draft-${Date.now()}`
  }`;

const getNextReferenceSetId = (
  visibleReferenceSetIds: readonly ElementReferenceSetId[]
): ElementReferenceSetId | null =>
  ELEMENT_REFERENCE_SET_IDS.find((setId) => !visibleReferenceSetIds.includes(setId)) ?? null;

const buildElementItemFromDraft = (
  draft: ElementDraft,
  options?: {
    id?: string;
    updatedAt?: string | null;
    status?: ElementLibraryItem["status"];
  }
): ElementLibraryItem => {
  const activeReferenceSet = draft.referenceSets[draft.activeReferenceSetId];
  return {
    id: options?.id ?? createIdFromName(draft.name),
    name: draft.name.trim(),
    alias: draft.alias.trim(),
    description: activeReferenceSet.description.trim(),
    assetType: draft.assetType,
    thumbnailUrl: null,
    imageReferenceUrls:
      draft.assetType === "image"
        ? activeReferenceSet.imageReferenceUrls.filter(Boolean).slice(0, 4)
        : [],
    videoReferenceUrl:
      draft.assetType === "video" ? activeReferenceSet.videoReferenceUrl.trim() || null : null,
    updatedAt: options?.updatedAt ?? new Date().toISOString(),
    status: options?.status ?? "ready",
    referenceSetState: {
      activeSetId: draft.activeReferenceSetId,
      tabOrder: draft.visibleReferenceSetIds,
      tabLabels: draft.referenceSetLabels,
      sets: draft.referenceSets,
    },
  };
};

export const useElementsManagerViewState = () => {
  const [activeTab, setActiveTab] = React.useState<ElementsWorkflowTab>("manage");
  const [elements, setElements] = React.useState<ElementLibraryItem[]>(() =>
    createMockElementsLibrary()
  );
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [pendingDeleteElementId, setPendingDeleteElementId] = React.useState<string | null>(null);
  const { draft, hydrateDraft, setDraft, resetDraft } = useElementsManagerDraft();

  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;

  const syncSelectedElement = React.useCallback(
    (nextDraft: ElementDraft, overrideId?: string | null) => {
      const targetId = overrideId ?? selectedElementId;
      if (!targetId) return;
      const nextItem = buildElementItemFromDraft(nextDraft, {
        id: targetId,
        status: "ready",
      });
      setElements((current) =>
        current.map((item) => (item.id === targetId ? { ...item, ...nextItem } : item))
      );
    },
    [selectedElementId]
  );

  const updateDraftField = React.useCallback(
    <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => {
      setDraft((current) => {
        const nextDraft = { ...current, [field]: value };
        if (selectedElementId) {
          syncSelectedElement(nextDraft, selectedElementId);
        }
        return nextDraft;
      });
    },
    [selectedElementId, setDraft, syncSelectedElement]
  );

  const updateActiveReferenceSet = React.useCallback(
    (
      updater: (
        current: ElementDraft["referenceSets"][ElementReferenceSetId]
      ) => ElementDraft["referenceSets"][ElementReferenceSetId]
    ) => {
      setDraft((current) => {
        const nextReferenceSets = {
          ...current.referenceSets,
          [current.activeReferenceSetId]: updater(
            current.referenceSets[current.activeReferenceSetId]
          ),
        };
        const nextDraft = {
          ...current,
          referenceSets: nextReferenceSets,
          description: nextReferenceSets[current.activeReferenceSetId].description,
          imageReferenceUrls: nextReferenceSets[current.activeReferenceSetId].imageReferenceUrls,
          videoReferenceUrl: nextReferenceSets[current.activeReferenceSetId].videoReferenceUrl,
        };
        if (selectedElementId) {
          syncSelectedElement(nextDraft, selectedElementId);
        }
        return nextDraft;
      });
    },
    [selectedElementId, setDraft, syncSelectedElement]
  );

  const setActiveReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId) => {
      setDraft((current) => {
        const nextDraft = {
          ...current,
          activeReferenceSetId: setId,
          description: current.referenceSets[setId].description,
          imageReferenceUrls: current.referenceSets[setId].imageReferenceUrls,
          videoReferenceUrl: current.referenceSets[setId].videoReferenceUrl,
        };
        if (selectedElementId) {
          syncSelectedElement(nextDraft, selectedElementId);
        }
        return nextDraft;
      });
    },
    [selectedElementId, setDraft, syncSelectedElement]
  );

  const handleCreateElement = React.useCallback(() => {
    const nextDraft = createEmptyElementDraft();
    const nextId = createIdFromName(`draft-${elements.length + 1}`);
    const nextItem = buildElementItemFromDraft(nextDraft, {
      id: nextId,
      status: "draft",
    });
    setElements((current) => [nextItem, ...current]);
    setSelectedElementId(nextId);
    hydrateDraft(nextItem);
    setActiveTab("profile");
  }, [elements.length, hydrateDraft]);

  const handleSelectElement = React.useCallback(
    (elementId: string) => {
      const nextSelected = elements.find((item) => item.id === elementId) ?? null;
      if (!nextSelected) return;
      setSelectedElementId(elementId);
      hydrateDraft(nextSelected);
      setActiveTab("profile");
    },
    [elements, hydrateDraft]
  );

  const handleDeleteElement = React.useCallback(() => {
    if (!pendingDeleteElementId) return;
    setElements((current) => current.filter((item) => item.id !== pendingDeleteElementId));
    if (selectedElementId === pendingDeleteElementId) {
      setSelectedElementId(null);
      resetDraft();
      setActiveTab("manage");
    }
    setPendingDeleteElementId(null);
  }, [pendingDeleteElementId, resetDraft, selectedElementId]);

  const onAddReferenceSet = React.useCallback(() => {
    setDraft((current) => {
      if (current.visibleReferenceSetIds.length >= MAX_ELEMENT_REFERENCE_SET_TAB_COUNT) {
        return current;
      }
      const nextSetId = getNextReferenceSetId(current.visibleReferenceSetIds);
      if (!nextSetId) return current;
      const nextReferenceSets = {
        ...current.referenceSets,
        [nextSetId]:
          current.referenceSets[nextSetId] ??
          createDefaultElementReferenceSetState().sets[nextSetId],
      };
      const nextDraft = {
        ...current,
        activeReferenceSetId: nextSetId,
        visibleReferenceSetIds: [...current.visibleReferenceSetIds, nextSetId],
        referenceSets: nextReferenceSets,
        description: nextReferenceSets[nextSetId].description,
        imageReferenceUrls: nextReferenceSets[nextSetId].imageReferenceUrls,
        videoReferenceUrl: nextReferenceSets[nextSetId].videoReferenceUrl,
      };
      syncSelectedElement(nextDraft);
      return nextDraft;
    });
  }, [setDraft, syncSelectedElement]);

  const onRenameReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId, nextLabel: string) => {
      setDraft((current) => {
        const nextDraft = {
          ...current,
          referenceSetLabels: {
            ...current.referenceSetLabels,
            [setId]: nextLabel.trim() || current.referenceSetLabels[setId],
          },
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const onDeleteReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId) => {
      setDraft((current) => {
        if (setId === "1") return current;
        const nextVisibleReferenceSetIds = current.visibleReferenceSetIds.filter(
          (visibleSetId) => visibleSetId !== setId
        );
        const fallbackSetId = nextVisibleReferenceSetIds[0] ?? "1";
        const nextReferenceSets = {
          ...current.referenceSets,
          [setId]: createDefaultElementReferenceSetState().sets[setId],
        };
        const nextDraft = {
          ...current,
          activeReferenceSetId: fallbackSetId,
          visibleReferenceSetIds: nextVisibleReferenceSetIds,
          referenceSets: nextReferenceSets,
          description: nextReferenceSets[fallbackSetId].description,
          imageReferenceUrls: nextReferenceSets[fallbackSetId].imageReferenceUrls,
          videoReferenceUrl: nextReferenceSets[fallbackSetId].videoReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  return {
    activeTab,
    elements,
    selectedElement,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    setActiveTab,
    updateDraftField,
    updateActiveReferenceSet,
    setActiveReferenceSet,
    onAddReferenceSet,
    onRenameReferenceSet,
    onDeleteReferenceSet,
    onCreateElement: handleCreateElement,
    onSelectElement: handleSelectElement,
    onRequestDeleteElement: setPendingDeleteElementId,
    onCancelDeleteElement: () => setPendingDeleteElementId(null),
    onConfirmDeleteElement: handleDeleteElement,
  };
};
