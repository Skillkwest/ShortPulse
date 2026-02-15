/**
 * Character Mode lifecycle hook for AI Studio page orchestration.
 * Owns character list loading, selected-character bundle loading, and create-model enforcement.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  listCharacterManagerCharacters,
  loadCharacterManagerDraftByCharacterId,
} from "../../character-manager/logic/characterManagerPersistence";
import {
  resolveCharacterSheetReferenceStoragePaths,
  resolveCharacterSheetReferenceUrls,
} from "../logic/characterModePayload";
import type { ToolId } from "../types";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

export type CharacterSelectOption = {
  id: string;
  name: string;
  profileImageUrl: string | null;
};

type UseAiStudioCharacterModeLifecycleParams = {
  isCharacterModeEnabled: boolean;
  selectedTool: ToolId | null;
  model: string | null;
  setModel: (value: string | null) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  setCharacterModeInjectionBundle: Dispatch<SetStateAction<CharacterModeInjectionBundle | null>>;
  setIsCharacterBundleLoading: Dispatch<SetStateAction<boolean>>;
  backgroundModelId: string;
};

/**
 * Returns Character Mode list selection state and keeps bundle/model side effects in sync.
 */
export const useAiStudioCharacterModeLifecycle = ({
  isCharacterModeEnabled,
  selectedTool,
  model,
  setModel,
  setUiError,
  setCharacterModeInjectionBundle,
  setIsCharacterBundleLoading,
  backgroundModelId,
}: UseAiStudioCharacterModeLifecycleParams) => {
  const [characterOptions, setCharacterOptions] = useState<CharacterSelectOption[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [isCharacterOptionsLoading, setIsCharacterOptionsLoading] = useState(true);
  const previousCreateModelBeforeCharacterModeRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    void listCharacterManagerCharacters()
      .then((items) => {
        if (!active) return;
        const mappedOptions = items.map((item) => ({
          id: item.characterId,
          name: item.characterName,
          profileImageUrl: item.profileImageUrl,
        }));
        setCharacterOptions(mappedOptions);
        setSelectedCharacterId((current) =>
          mappedOptions.some((option) => option.id === current) ? current : ""
        );
      })
      .catch((error) => {
        if (!active) return;
        const message =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to load Character Manager profiles.";
        const normalized = message.toLowerCase();
        const isSessionTransitionError =
          normalized.includes("no active session") || normalized.includes("not authenticated");
        if (!isSessionTransitionError) {
          setUiError(message);
        }
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterOptionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setUiError]);

  useEffect(() => {
    let active = true;
    if (!selectedCharacterId) {
      setCharacterModeInjectionBundle(null);
      setIsCharacterBundleLoading(false);
      return () => {
        active = false;
      };
    }

    setIsCharacterBundleLoading(true);
    setCharacterModeInjectionBundle(null);
    void loadCharacterManagerDraftByCharacterId(selectedCharacterId)
      .then((snapshot) => {
        if (!active) return;
        setCharacterModeInjectionBundle({
          characterId: snapshot.characterId,
          characterDescription: snapshot.characterDescription,
          sheetReferenceStoragePaths: resolveCharacterSheetReferenceStoragePaths(
            snapshot.characterSheetAssignments,
            snapshot.slots
          ),
          sheetReferenceUrls: resolveCharacterSheetReferenceUrls(
            snapshot.characterSheetAssignments,
            snapshot.slots
          ),
          loadedAtMs: Date.now(),
        });
      })
      .catch(() => {
        if (!active) return;
        setCharacterModeInjectionBundle(null);
      })
      .finally(() => {
        if (!active) return;
        setIsCharacterBundleLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedCharacterId, setCharacterModeInjectionBundle, setIsCharacterBundleLoading]);

  useEffect(() => {
    const isCreateWorkflowTool = selectedTool === "create" || selectedTool === "text";
    const characterModeAppliesToCreate = isCharacterModeEnabled && isCreateWorkflowTool;

    if (characterModeAppliesToCreate) {
      if (
        model &&
        model !== backgroundModelId &&
        !previousCreateModelBeforeCharacterModeRef.current
      ) {
        previousCreateModelBeforeCharacterModeRef.current = model;
      }
      if (model !== backgroundModelId) {
        setModel(backgroundModelId);
      }
      return;
    }

    if (!isCharacterModeEnabled && isCreateWorkflowTool && model === backgroundModelId) {
      previousCreateModelBeforeCharacterModeRef.current = null;
      setModel(null);
      return;
    }

    const wasForcedByCharacterMode = previousCreateModelBeforeCharacterModeRef.current != null;
    previousCreateModelBeforeCharacterModeRef.current = null;
    if (!isCharacterModeEnabled && model === backgroundModelId && wasForcedByCharacterMode) {
      setModel(null);
    }
  }, [backgroundModelId, isCharacterModeEnabled, model, selectedTool, setModel]);

  return {
    characterOptions,
    selectedCharacterId,
    setSelectedCharacterId,
    isCharacterOptionsLoading,
  };
};
