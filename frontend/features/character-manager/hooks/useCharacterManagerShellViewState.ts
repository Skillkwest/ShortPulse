import React from "react";
import type {
  CharacterQuickSwapItem,
  CharacterSheetPresetId,
  CharacterWorkflowTab,
} from "../types";

type UseCharacterManagerShellViewStateParams = {
  initialWorkflowTab?: CharacterWorkflowTab;
  isQuickSwapTipHidden: boolean;
  markQuickSwapTipHidden: (options?: { persistRemotely?: boolean }) => Promise<unknown>;
  quickSwapActiveItems: CharacterQuickSwapItem[];
  isDeletingCharacter: boolean;
  isSavingCharacterSheetPreset: boolean;
};

type UseCharacterManagerShellViewStateResult = {
  activeTab: CharacterWorkflowTab;
  setActiveTab: React.Dispatch<React.SetStateAction<CharacterWorkflowTab>>;
  isQuickSwapCollapsed: boolean;
  setIsQuickSwapCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  deleteTargetCharacter: {
    characterId: string;
    characterName: string;
  } | null;
  setDeleteTargetCharacter: React.Dispatch<
    React.SetStateAction<{
      characterId: string;
      characterName: string;
    } | null>
  >;
  deleteTargetCharacterSheetPresetId: CharacterSheetPresetId | null;
  setDeleteTargetCharacterSheetPresetId: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetId | null>
  >;
  referencePreview: {
    index: number;
    aspectRatio: number;
  } | null;
  setReferencePreview: React.Dispatch<
    React.SetStateAction<{
      index: number;
      aspectRatio: number;
    } | null>
  >;
  referencePreviewSignedUrl: {
    itemId: string;
    url: string;
  } | null;
  setReferencePreviewSignedUrl: React.Dispatch<
    React.SetStateAction<{
      itemId: string;
      url: string;
    } | null>
  >;
  characterLibraryVisibleCount: number;
  setCharacterLibraryVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  quickSwapGridColumnCount: number;
  quickSwapArchiveGridColumnCount: number;
  cancelDeleteCharacter: () => void;
  cancelDeleteCharacterSheetPreset: () => void;
  openReferencePreview: (index: number, aspectRatio: number | null) => void;
  closeReferencePreview: () => void;
  navigateReferencePreview: (step: -1 | 1) => void;
};

const CHARACTER_LIBRARY_SMOOTH_TARGET = 24;
const QUICK_SWAP_GUIDANCE_HIDE_ROW_THRESHOLD = 4;
const DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO = 4 / 5;

const clampReferencePreviewAspectRatio = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO;
  }
  return Math.min(Math.max(value, 0.45), 2.8);
};

const resolveInitialQuickSwapGridColumnCount = (): number => {
  if (typeof window === "undefined") return 4;
  if (typeof window.matchMedia !== "function") return 4;
  return window.matchMedia("(max-width: 860px)").matches ? 2 : 4;
};

const resolveInitialQuickSwapArchiveGridColumnCount = (): number => {
  if (typeof window === "undefined") return 4;
  if (typeof window.matchMedia !== "function") return 4;
  return window.matchMedia("(max-width: 900px)").matches ? 2 : 4;
};

export const useCharacterManagerShellViewState = ({
  initialWorkflowTab,
  isQuickSwapTipHidden,
  markQuickSwapTipHidden,
  quickSwapActiveItems,
  isDeletingCharacter,
  isSavingCharacterSheetPreset,
}: UseCharacterManagerShellViewStateParams): UseCharacterManagerShellViewStateResult => {
  const [activeTab, setActiveTab] = React.useState<CharacterWorkflowTab>(
    initialWorkflowTab ?? "create"
  );
  const [isQuickSwapCollapsed, setIsQuickSwapCollapsed] = React.useState(false);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = React.useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [deleteTargetCharacterSheetPresetId, setDeleteTargetCharacterSheetPresetId] =
    React.useState<CharacterSheetPresetId | null>(null);
  const [referencePreview, setReferencePreview] = React.useState<{
    index: number;
    aspectRatio: number;
  } | null>(null);
  const [referencePreviewSignedUrl, setReferencePreviewSignedUrl] = React.useState<{
    itemId: string;
    url: string;
  } | null>(null);
  const [characterLibraryVisibleCount, setCharacterLibraryVisibleCount] = React.useState(
    CHARACTER_LIBRARY_SMOOTH_TARGET
  );
  const [quickSwapGridColumnCount, setQuickSwapGridColumnCount] = React.useState(
    resolveInitialQuickSwapGridColumnCount
  );
  const [quickSwapArchiveGridColumnCount, setQuickSwapArchiveGridColumnCount] = React.useState(
    resolveInitialQuickSwapArchiveGridColumnCount
  );

  const quickSwapVisibleRowCount = React.useMemo(() => {
    const columnCount = Math.max(1, quickSwapGridColumnCount);
    const renderedCardCount = quickSwapActiveItems.length + 1;
    return Math.max(1, Math.ceil(renderedCardCount / columnCount));
  }, [quickSwapActiveItems.length, quickSwapGridColumnCount]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const archiveMediaQuery = window.matchMedia("(max-width: 900px)");
    const applyColumnCount = () => {
      setQuickSwapGridColumnCount(mediaQuery.matches ? 2 : 4);
      setQuickSwapArchiveGridColumnCount(archiveMediaQuery.matches ? 2 : 4);
    };
    applyColumnCount();

    if (
      typeof mediaQuery.addEventListener === "function" &&
      typeof archiveMediaQuery.addEventListener === "function"
    ) {
      mediaQuery.addEventListener("change", applyColumnCount);
      archiveMediaQuery.addEventListener("change", applyColumnCount);
      return () => {
        mediaQuery.removeEventListener("change", applyColumnCount);
        archiveMediaQuery.removeEventListener("change", applyColumnCount);
      };
    }

    mediaQuery.addListener(applyColumnCount);
    archiveMediaQuery.addListener(applyColumnCount);
    return () => {
      mediaQuery.removeListener(applyColumnCount);
      archiveMediaQuery.removeListener(applyColumnCount);
    };
  }, []);

  React.useEffect(() => {
    if (isQuickSwapTipHidden) return;
    if (quickSwapVisibleRowCount < QUICK_SWAP_GUIDANCE_HIDE_ROW_THRESHOLD) return;
    void markQuickSwapTipHidden({ persistRemotely: false });
  }, [isQuickSwapTipHidden, markQuickSwapTipHidden, quickSwapVisibleRowCount]);

  const cancelDeleteCharacter = React.useCallback(() => {
    if (isDeletingCharacter) return;
    setDeleteTargetCharacter(null);
  }, [isDeletingCharacter]);

  const cancelDeleteCharacterSheetPreset = React.useCallback(() => {
    if (isSavingCharacterSheetPreset) return;
    setDeleteTargetCharacterSheetPresetId(null);
  }, [isSavingCharacterSheetPreset]);

  const openReferencePreview = React.useCallback((index: number, aspectRatio: number | null) => {
    setReferencePreview({
      index,
      aspectRatio: clampReferencePreviewAspectRatio(aspectRatio),
    });
  }, []);

  const closeReferencePreview = React.useCallback(() => {
    setReferencePreview(null);
    setReferencePreviewSignedUrl(null);
  }, []);

  const navigateReferencePreview = React.useCallback(
    (step: -1 | 1) => {
      setReferencePreview((current) => {
        if (!current || quickSwapActiveItems.length === 0) return current;
        const total = quickSwapActiveItems.length;
        const nextIndex = (current.index + step + total) % total;
        return {
          index: nextIndex,
          aspectRatio: current.aspectRatio,
        };
      });
    },
    [quickSwapActiveItems.length]
  );

  return {
    activeTab,
    setActiveTab,
    isQuickSwapCollapsed,
    setIsQuickSwapCollapsed,
    deleteTargetCharacter,
    setDeleteTargetCharacter,
    deleteTargetCharacterSheetPresetId,
    setDeleteTargetCharacterSheetPresetId,
    referencePreview,
    setReferencePreview,
    referencePreviewSignedUrl,
    setReferencePreviewSignedUrl,
    characterLibraryVisibleCount,
    setCharacterLibraryVisibleCount,
    quickSwapGridColumnCount,
    quickSwapArchiveGridColumnCount,
    cancelDeleteCharacter,
    cancelDeleteCharacterSheetPreset,
    openReferencePreview,
    closeReferencePreview,
    navigateReferencePreview,
  };
};
