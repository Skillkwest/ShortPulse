import { useCharacterManagerDraft } from "./useCharacterManagerDraft";

type UseCharacterPanelDraftOptions = Parameters<typeof useCharacterManagerDraft>[0];

/**
 * Panel-facing facade for the Character Manager draft runtime.
 * Keeps the live Character panel on the smaller surface it actually consumes.
 */
export const useCharacterPanelDraft = (options?: UseCharacterPanelDraftOptions) => {
  const draft = useCharacterManagerDraft(options);

  return {
    characters: draft.characters,
    selectedCharacterId: draft.selectedCharacterId,
    characterName: draft.characterName,
    characterDescription: draft.characterDescription,
    activeCharacterSheetPresetId: draft.activeCharacterSheetPresetId,
    visibleCharacterSheetPresetIds: draft.visibleCharacterSheetPresetIds,
    characterSheetPresetLabels: draft.characterSheetPresetLabels,
    characterSheetPresetAssignments: draft.characterSheetPresetAssignments,
    error: draft.error,
    loading: draft.loading,
    isSavingName: draft.isSavingName,
    isCreatingCharacter: draft.isCreatingCharacter,
    isSavingCharacter: draft.isSavingCharacter,
    characterSaveProgressMessage: draft.characterSaveProgressMessage,
    isDeletingCharacter: draft.isDeletingCharacter,
    isSwitchingCharacter: draft.isSwitchingCharacter,
    isSavingCharacterSheetPreset: draft.isSavingCharacterSheetPreset,
    isDeletingCharacterSheetPreset: draft.isDeletingCharacterSheetPreset,
    setCharacterName: draft.setCharacterName,
    setCharacterDescription: draft.setCharacterDescription,
    setActiveCharacterSheetPreset: draft.setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments: draft.saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset: draft.addCharacterSheetPreset,
    renameCharacterSheetPreset: draft.renameCharacterSheetPreset,
    deleteCharacterSheetPreset: draft.deleteCharacterSheetPreset,
    setCharacterSheetPresetFile: draft.setCharacterSheetPresetFile,
    createCharacter: draft.createCharacter,
    saveCharacter: draft.saveCharacter,
    selectCharacter: draft.selectCharacter,
    deleteCharacter: draft.deleteCharacter,
    clearMessages: draft.clearMessages,
    setErrorMessage: draft.setErrorMessage,
  };
};
