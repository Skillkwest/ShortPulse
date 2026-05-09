import { useMemo, useState } from "react";

import type { StudioOutput } from "../types";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";

type OptimisticDebitEntry = { credits: number; outputId: string | null; createdAtMs?: number };

type UseAiStudioPageLocalStateArgs = {
  sessionId: string | null;
};

/**
 * Owns page-local UI/runtime state that does not belong to durable AI Studio state.
 */
export const useAiStudioPageLocalState = ({ sessionId }: UseAiStudioPageLocalStateArgs) => {
  const [optimisticDebitEntries, setOptimisticDebitEntries] = useState<OptimisticDebitEntry[]>([]);
  const [isCreateCharacterBundleLoading, setIsCreateCharacterBundleLoading] = useState(false);
  const [isEditCharacterBundleLoading, setIsEditCharacterBundleLoading] = useState(false);
  const [isCreateCharacterModeEnabled, setIsCreateCharacterModeEnabled] = useState(false);
  const [isEditCharacterModeEnabled, setIsEditCharacterModeEnabled] = useState(false);
  const [createSelectedCharacterLookId, setCreateSelectedCharacterLookId] = useState("");
  const [characterCreateRequestKey, setCharacterCreateRequestKey] = useState(0);
  const [elementCreateRequestKey, setElementCreateRequestKey] = useState(0);
  const [editSelectedCharacterId, setEditSelectedCharacterId] = useState("");
  const [selectedStylePrompt, setSelectedStylePrompt] = useState<string | null>(null);
  const [selectedStyleContext, setSelectedStyleContext] = useState<
    StudioOutput["styleContext"] | null
  >(null);
  const [sessionTitleOverrideState, setSessionTitleOverrideState] = useState<{
    sessionId: string | null;
    title: string | null;
  } | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [createCharacterModeInjectionBundle, setCreateCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);
  const [editCharacterModeInjectionBundle, setEditCharacterModeInjectionBundle] =
    useState<CharacterModeInjectionBundle | null>(null);

  const localSessionTitleOverride = useMemo(
    () =>
      sessionTitleOverrideState?.sessionId === sessionId ? sessionTitleOverrideState.title : null,
    [sessionId, sessionTitleOverrideState]
  );

  return {
    characterCreateRequestKey,
    createCharacterModeInjectionBundle,
    createSelectedCharacterLookId,
    editCharacterModeInjectionBundle,
    editSelectedCharacterId,
    elementCreateRequestKey,
    isCreateCharacterBundleLoading,
    isCreateCharacterModeEnabled,
    isEditCharacterBundleLoading,
    isEditCharacterModeEnabled,
    isProjectsModalOpen,
    localSessionTitleOverride,
    optimisticDebitEntries,
    selectedStyleContext,
    selectedStylePrompt,
    setCharacterCreateRequestKey,
    setCreateCharacterModeInjectionBundle,
    setCreateSelectedCharacterLookId,
    setEditCharacterModeInjectionBundle,
    setEditSelectedCharacterId,
    setElementCreateRequestKey,
    setIsCreateCharacterBundleLoading,
    setIsCreateCharacterModeEnabled,
    setIsEditCharacterBundleLoading,
    setIsEditCharacterModeEnabled,
    setIsProjectsModalOpen,
    setOptimisticDebitEntries,
    setSelectedStyleContext,
    setSelectedStylePrompt,
    setSessionTitleOverrideState,
    sessionTitleOverrideState,
  };
};

export type AiStudioPageLocalState = ReturnType<typeof useAiStudioPageLocalState>;
