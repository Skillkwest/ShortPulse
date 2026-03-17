import React from "react";
import type { CharacterQuickSwapItem, CharacterSheetPresetId } from "../types";

type CharacterWorkflowTab = "create" | "manage";
type CharacterManagerShellSurface = "page" | "panel";

type UseCharacterManagerShellViewStateParams = {
  initialWorkflowTab?: CharacterWorkflowTab;
  surface: CharacterManagerShellSurface;
  beginnerModeOverride?: boolean;
  isQuickSwapTipHidden: boolean;
  markQuickSwapTipHidden: () => Promise<unknown>;
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
  beginnerMode: boolean;
  setBeginnerMode: React.Dispatch<React.SetStateAction<boolean>>;
  quickSwapGridColumnCount: number;
  quickSwapArchiveGridColumnCount: number;
  isEmbeddedSurface: boolean;
  effectiveBeginnerMode: boolean;
  showQuickSwapCollapseToggle: boolean;
  cancelDeleteCharacter: () => void;
  cancelDeleteCharacterSheetPreset: () => void;
  openReferencePreview: (index: number, aspectRatio: number | null) => void;
  closeReferencePreview: () => void;
  navigateReferencePreview: (step: -1 | 1) => void;
};

const CHARACTER_LIBRARY_SMOOTH_TARGET = 24;
const CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY = "shortpulse.character_manager.beginner_mode";
const QUICK_SWAP_GUIDANCE_HIDE_ROW_THRESHOLD = 4;
const DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO = 4 / 5;

const clampReferencePreviewAspectRatio = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO;
  }
  return Math.min(Math.max(value, 0.45), 2.8);
};

const resolveInitialBeginnerMode = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY);
    if (stored == null) return true;
    return stored === "true";
  } catch {
    return true;
  }
};

const resolveInitialQuickSwapGridColumnCount = (): number => {
  if (typeof window === "undefined") return 3;
  if (typeof window.matchMedia !== "function") return 3;
  return window.matchMedia("(max-width: 860px)").matches ? 2 : 3;
};

const resolveInitialQuickSwapArchiveGridColumnCount = (): number => {
  if (typeof window === "undefined") return 4;
  if (typeof window.matchMedia !== "function") return 4;
  return window.matchMedia("(max-width: 900px)").matches ? 2 : 4;
};

export const useCharacterManagerShellViewState = ({
  initialWorkflowTab,
  surface,
  beginnerModeOverride,
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
  const [beginnerMode, setBeginnerMode] = React.useState(resolveInitialBeginnerMode);
  const [quickSwapGridColumnCount, setQuickSwapGridColumnCount] = React.useState(
    resolveInitialQuickSwapGridColumnCount
  );
  const [quickSwapArchiveGridColumnCount, setQuickSwapArchiveGridColumnCount] = React.useState(
    resolveInitialQuickSwapArchiveGridColumnCount
  );

  const isEmbeddedSurface = surface === "panel";
  const isBeginnerModeControlled = typeof beginnerModeOverride === "boolean";
  const effectiveBeginnerMode = isBeginnerModeControlled ? beginnerModeOverride : beginnerMode;
  const showQuickSwapCollapseToggle = surface !== "panel" || effectiveBeginnerMode;
  const quickSwapVisibleRowCount = React.useMemo(() => {
    const columnCount = Math.max(1, quickSwapGridColumnCount);
    const renderedCardCount = quickSwapActiveItems.length + 1;
    return Math.max(1, Math.ceil(renderedCardCount / columnCount));
  }, [quickSwapActiveItems.length, quickSwapGridColumnCount]);

  React.useEffect(() => {
    if (isBeginnerModeControlled) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY, String(beginnerMode));
  }, [beginnerMode, isBeginnerModeControlled]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const archiveMediaQuery = window.matchMedia("(max-width: 900px)");
    const applyColumnCount = () => {
      setQuickSwapGridColumnCount(mediaQuery.matches ? 2 : 3);
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
    void markQuickSwapTipHidden();
  }, [isQuickSwapTipHidden, markQuickSwapTipHidden, quickSwapVisibleRowCount]);

  React.useEffect(() => {
    if (showQuickSwapCollapseToggle || !isQuickSwapCollapsed) return;
    setIsQuickSwapCollapsed(false);
  }, [isQuickSwapCollapsed, showQuickSwapCollapseToggle]);

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
          aspectRatio: clampReferencePreviewAspectRatio(null),
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
    beginnerMode,
    setBeginnerMode,
    quickSwapGridColumnCount,
    quickSwapArchiveGridColumnCount,
    isEmbeddedSurface,
    effectiveBeginnerMode,
    showQuickSwapCollapseToggle,
    cancelDeleteCharacter,
    cancelDeleteCharacterSheetPreset,
    openReferencePreview,
    closeReferencePreview,
    navigateReferencePreview,
  };
};
