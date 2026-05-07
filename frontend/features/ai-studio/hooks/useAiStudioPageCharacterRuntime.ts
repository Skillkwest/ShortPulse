/**
 * AI Studio page character-mode runtime.
 * Owns page-level character lifecycle, look selection, submission overrides, and entry actions.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import {
  useAiStudioCharacterModeController,
  type CharacterModeInjectionBundle,
} from "./useAiStudioCharacterModeController";
import { useAiStudioCharacterModeLifecycle } from "./useAiStudioCharacterModeLifecycle";
import { useAiStudioCreateCharacterLookState } from "./useAiStudioCreateCharacterLookState";
import type { ToolId } from "../types";

type UseAiStudioPageCharacterRuntimeParams = {
  createCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
  createSelectedCharacterLookId: string;
  editCharacterModeInjectionBundle: CharacterModeInjectionBundle | null;
  editSelectedCharacterId: string;
  isCreateCharacterBundleLoading: boolean;
  isCreateCharacterModeEnabled: boolean;
  isEditCharacterBundleLoading: boolean;
  isEditCharacterModeEnabled: boolean;
  projectId: string | null;
  projectRouteRequested: boolean;
  selectedTool: ToolId | null;
  setCharacterCreateRequestKey: Dispatch<SetStateAction<number>>;
  setCreateCharacterModeInjectionBundle: Dispatch<
    SetStateAction<CharacterModeInjectionBundle | null>
  >;
  setCreateSelectedCharacterLookId: Dispatch<SetStateAction<string>>;
  setEditCharacterModeInjectionBundle: Dispatch<
    SetStateAction<CharacterModeInjectionBundle | null>
  >;
  setElementCreateRequestKey: Dispatch<SetStateAction<number>>;
  setIsCreateCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
  setIsEditCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
  setSelectedToolWithEditIntentReset: (nextTool: ToolId | null) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  trackCharacterModeEvent: (message: string, data?: Record<string, unknown>) => void;
};

/**
 * Returns page-shell character-mode runtime helpers and state.
 */
export const useAiStudioPageCharacterRuntime = ({
  createCharacterModeInjectionBundle,
  createSelectedCharacterLookId,
  editCharacterModeInjectionBundle,
  editSelectedCharacterId,
  isCreateCharacterBundleLoading,
  isCreateCharacterModeEnabled,
  isEditCharacterBundleLoading,
  isEditCharacterModeEnabled,
  projectId,
  projectRouteRequested,
  selectedTool,
  setCharacterCreateRequestKey,
  setCreateCharacterModeInjectionBundle,
  setCreateSelectedCharacterLookId,
  setEditCharacterModeInjectionBundle,
  setElementCreateRequestKey,
  setIsCreateCharacterBundleLoading,
  setIsEditCharacterBundleLoading,
  setSelectedToolWithEditIntentReset,
  setUiError,
  trackCharacterModeEvent,
}: UseAiStudioPageCharacterRuntimeParams) => {
  const {
    characterOptions,
    selectedCharacterId: createSelectedCharacterId,
    setSelectedCharacterId: setCreateSelectedCharacterId,
    isCharacterOptionsLoading,
    refreshCharacterOptions,
    resolveCharacterOptionById,
  } = useAiStudioCharacterModeLifecycle({
    projectId,
    projectRouteRequested,
    selectedTool,
    selectedCharacterLookId: createSelectedCharacterLookId,
    setUiError,
    setCharacterModeInjectionBundle: setCreateCharacterModeInjectionBundle,
    setIsCharacterBundleLoading: setIsCreateCharacterBundleLoading,
  });

  const {
    handleCreateCharacterSelection,
    loadCreateCharacterLookOptions,
    selectedCreateCharacterLookLabel,
  } = useAiStudioCreateCharacterLookState({
    createSelectedCharacterId,
    setCreateSelectedCharacterId,
    createSelectedCharacterLookId,
    setCreateSelectedCharacterLookId,
    createCharacterModeInjectionBundle,
  });

  const resolveIsCharacterModeEnabledForTool = useCallback(
    (tool: ToolId | null): boolean => {
      if (tool === "create" || tool === "text") return isCreateCharacterModeEnabled;
      if (tool === "edit" || tool === "image") return isEditCharacterModeEnabled;
      return false;
    },
    [isCreateCharacterModeEnabled, isEditCharacterModeEnabled]
  );

  const resolveSelectedCharacterIdForTool = useCallback(
    (tool: ToolId | null): string | null => {
      if (tool === "create" || tool === "text") {
        return createSelectedCharacterId?.trim() || null;
      }
      if (tool === "edit" || tool === "image") {
        return editSelectedCharacterId?.trim() || null;
      }
      return null;
    },
    [createSelectedCharacterId, editSelectedCharacterId]
  );

  const resolveCharacterAvatarUrlById = useCallback(
    (characterId: string | null | undefined): string | null =>
      resolveCharacterOptionById(characterId)?.profileImageUrl?.trim() ?? null,
    [resolveCharacterOptionById]
  );

  const {
    refreshCharacterModeInjectionBundleForSubmission,
    resolveCharacterModeSubmissionOverrides,
    trackCharacterModeFallback,
  } = useAiStudioCharacterModeController({
    isCharacterModeEnabled: isCreateCharacterModeEnabled,
    selectedCharacterId: createSelectedCharacterId,
    selectedCharacterLookId: createSelectedCharacterLookId,
    characterModeInjectionBundle: createCharacterModeInjectionBundle,
    isCharacterBundleLoading: isCreateCharacterBundleLoading,
    editCharacterModeEnabled: isEditCharacterModeEnabled,
    editSelectedCharacterId,
    editCharacterModeInjectionBundle,
    isEditCharacterBundleLoading,
    characterOptions,
    setCharacterModeInjectionBundle: setCreateCharacterModeInjectionBundle,
    setIsCharacterBundleLoading: setIsCreateCharacterBundleLoading,
    setEditCharacterModeInjectionBundle,
    setIsEditCharacterBundleLoading,
    trackCharacterModeEvent,
    bundleStaleAfterMs: 45 * 60 * 1000,
  });

  const handleOpenCharacterCreate = useCallback(() => {
    setSelectedToolWithEditIntentReset("character");
    setCharacterCreateRequestKey((current) => current + 1);
  }, [setCharacterCreateRequestKey, setSelectedToolWithEditIntentReset]);

  const handleOpenCharacterLibrary = useCallback(() => {
    setSelectedToolWithEditIntentReset("character");
  }, [setSelectedToolWithEditIntentReset]);

  const handleOpenElementCreate = useCallback(() => {
    setSelectedToolWithEditIntentReset("elements");
    setElementCreateRequestKey((current) => current + 1);
  }, [setElementCreateRequestKey, setSelectedToolWithEditIntentReset]);

  return {
    characterOptions,
    createSelectedCharacterId,
    handleCreateCharacterSelection,
    handleOpenCharacterCreate,
    handleOpenCharacterLibrary,
    handleOpenElementCreate,
    isCharacterOptionsLoading,
    loadCreateCharacterLookOptions,
    refreshCharacterModeInjectionBundleForSubmission,
    refreshCharacterOptions,
    resolveCharacterAvatarUrlById,
    resolveCharacterModeSubmissionOverrides,
    resolveIsCharacterModeEnabledForTool,
    resolveSelectedCharacterIdForTool,
    selectedCreateCharacterLookLabel,
    setCreateSelectedCharacterId,
    trackCharacterModeFallback,
  };
};
