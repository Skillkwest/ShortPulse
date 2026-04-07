import React from "react";
import { createMockElementsLibrary } from "../constants";
import type {
  ElementAssetType,
  ElementLibraryItem,
  ElementsProfileMode,
  ElementsWorkflowTab,
} from "../types";
import { useElementsManagerDraft } from "./useElementsManagerDraft";

const createIdFromName = (name: string): string =>
  `element-${
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "draft"
  }`;

const validateDraft = ({
  assetType,
  imageReferenceUrls,
  videoReferenceUrl,
  name,
}: {
  assetType: ElementAssetType;
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
  name: string;
}): string | null => {
  if (!name.trim()) return "Element name is required.";
  if (assetType === "image" && imageReferenceUrls.filter(Boolean).length < 2) {
    return "Image elements need at least 2 reference images.";
  }
  if (assetType === "video" && !videoReferenceUrl.trim()) {
    return "Video elements need one reference video.";
  }
  return null;
};

export const useElementsManagerViewState = () => {
  const [activeTab, setActiveTab] = React.useState<ElementsWorkflowTab>("manage");
  const [elements, setElements] = React.useState<ElementLibraryItem[]>(() =>
    createMockElementsLibrary()
  );
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [profileMode, setProfileMode] = React.useState<ElementsProfileMode>("create");
  const [pendingDeleteElementId, setPendingDeleteElementId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const { draft, hydrateDraft, updateDraftField, resetDraft } = useElementsManagerDraft();

  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;

  const handleCreateElement = React.useCallback(() => {
    setActiveTab("profile");
    setProfileMode("create");
    setSelectedElementId(null);
    setErrorMessage(null);
    resetDraft();
  }, [resetDraft]);

  const handleSelectElement = React.useCallback(
    (elementId: string) => {
      const nextSelected = elements.find((item) => item.id === elementId) ?? null;
      setSelectedElementId(elementId);
      setProfileMode("edit");
      setActiveTab("profile");
      setErrorMessage(null);
      hydrateDraft(nextSelected);
    },
    [elements, hydrateDraft]
  );

  const handleDeleteElement = React.useCallback(() => {
    if (!pendingDeleteElementId) return;
    setElements((current) => current.filter((item) => item.id !== pendingDeleteElementId));
    const deletingSelected = selectedElementId === pendingDeleteElementId;
    setPendingDeleteElementId(null);
    setErrorMessage(null);
    if (deletingSelected) {
      setSelectedElementId(null);
      setProfileMode("create");
      setActiveTab("manage");
      resetDraft();
    }
  }, [pendingDeleteElementId, resetDraft, selectedElementId]);

  const handleSaveElement = React.useCallback(() => {
    const validationError = validateDraft(draft);
    if (validationError) {
      setErrorMessage(validationError);
      return false;
    }

    const nextItem: ElementLibraryItem = {
      id:
        profileMode === "edit" && selectedElement
          ? selectedElement.id
          : createIdFromName(draft.name),
      name: draft.name.trim(),
      alias: draft.alias.trim(),
      description: draft.description.trim(),
      assetType: draft.assetType,
      thumbnailUrl: null,
      imageReferenceUrls:
        draft.assetType === "image" ? draft.imageReferenceUrls.filter(Boolean).slice(0, 4) : [],
      videoReferenceUrl: draft.assetType === "video" ? draft.videoReferenceUrl.trim() : null,
      updatedAt: new Date().toISOString(),
      status: "ready",
    };

    setElements((current) => {
      if (profileMode === "edit" && selectedElement) {
        return current.map((item) => (item.id === selectedElement.id ? nextItem : item));
      }
      return [nextItem, ...current];
    });

    setSelectedElementId(nextItem.id);
    setProfileMode("edit");
    setActiveTab("profile");
    setErrorMessage(null);
    hydrateDraft(nextItem);
    return true;
  }, [draft, hydrateDraft, profileMode, selectedElement]);

  const handleTabChange = React.useCallback(
    (tab: ElementsWorkflowTab) => {
      setActiveTab(tab);
      if (tab === "profile" && !selectedElementId && profileMode !== "create") {
        setProfileMode("create");
        resetDraft();
      }
    },
    [profileMode, resetDraft, selectedElementId]
  );

  return {
    activeTab,
    elements,
    selectedElement,
    selectedElementId,
    profileMode,
    pendingDeleteElementId,
    errorMessage,
    draft,
    setActiveTab: handleTabChange,
    updateDraftField,
    onCreateElement: handleCreateElement,
    onSelectElement: handleSelectElement,
    onRequestDeleteElement: setPendingDeleteElementId,
    onCancelDeleteElement: () => setPendingDeleteElementId(null),
    onConfirmDeleteElement: handleDeleteElement,
    onSaveElement: handleSaveElement,
  };
};
