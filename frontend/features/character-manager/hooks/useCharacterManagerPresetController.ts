/**
 * Character Manager look orchestration controller.
 * Owns active look switching, tab mutations, assignment persistence, and description sync/rollback.
 */
import React from "react";
import {
  deleteCharacterManagerCharacterSheetPreset,
  saveCharacterManagerActiveCharacterSheetPreset,
  saveCharacterManagerCharacterSheetPresetAssignments,
  saveCharacterManagerCharacterSheetPresetTabDescription,
  saveCharacterManagerCharacterSheetPresetTabLabel,
  saveCharacterManagerCharacterSheetPresetTabOrder,
} from "../logic/characterManagerPersistence";
import {
  getNextCharacterSheetPresetId,
  mergeCharacterSheetPresetTabDescriptions,
  sanitizeCharacterSheetPresetTabLabel,
} from "../logic/characterSheetPresetTabs";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import type {
  CharacterSheetPresetAssignments,
  CharacterSheetPresetDescriptionMap,
  CharacterSheetPresetId,
  CharacterSheetPresetState,
} from "../types";

type PersistedPresetState = Awaited<
  ReturnType<typeof saveCharacterManagerActiveCharacterSheetPreset>
>;

type UseCharacterManagerPresetControllerParams = {
  characterId: string | null;
  clearMessages: () => void;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSavingCharacterSheetPreset: React.Dispatch<React.SetStateAction<boolean>>;
  activeCharacterSheetPresetIdRef: React.MutableRefObject<CharacterSheetPresetId>;
  activeCharacterSheetPresetRequestRef: React.MutableRefObject<number>;
  characterSheetPresetsRef: React.MutableRefObject<CharacterSheetPresetState["presets"]>;
  visibleCharacterSheetPresetIdsRef: React.MutableRefObject<CharacterSheetPresetState["tabOrder"]>;
  characterSheetPresetLabelsRef: React.MutableRefObject<CharacterSheetPresetState["tabLabels"]>;
  characterSheetPresetDescriptionsRef: React.MutableRefObject<CharacterSheetPresetDescriptionMap>;
  lastPersistedDescriptionMapRef: React.MutableRefObject<CharacterSheetPresetDescriptionMap>;
  descriptionPersistTimerRefs: React.MutableRefObject<
    Record<CharacterSheetPresetId, number | null>
  >;
  descriptionPersistRequestRef: React.MutableRefObject<Record<CharacterSheetPresetId, number>>;
  characterSheetPresetAssignmentsRequestRef: React.MutableRefObject<number>;
  characterSheetPresetTabOrderRequestRef: React.MutableRefObject<number>;
  characterSheetPresetTabLabelRequestRef: React.MutableRefObject<number>;
  setActiveCharacterSheetPresetIdState: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetId>
  >;
  setCharacterSheetPresets: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetState["presets"]>
  >;
  setVisibleCharacterSheetPresetIds: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetState["tabOrder"]>
  >;
  setCharacterSheetPresetLabels: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetState["tabLabels"]>
  >;
  setCharacterSheetPresetDescriptions: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetDescriptionMap>
  >;
  setCharacterSheetPresetAssignments: React.Dispatch<
    React.SetStateAction<CharacterSheetPresetAssignments>
  >;
  setCharacterDescriptionState: React.Dispatch<React.SetStateAction<string>>;
  toErrorMessage: (error: unknown, fallback: string) => string;
};

type UseCharacterManagerPresetControllerResult = {
  setCharacterDescription: (value: string) => void;
  setActiveCharacterSheetPreset: (presetId: CharacterSheetPresetId) => Promise<boolean>;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<boolean>;
  addCharacterSheetPreset: () => Promise<boolean>;
  renameCharacterSheetPreset: (
    presetId: CharacterSheetPresetId,
    nextLabel: string
  ) => Promise<boolean>;
  deleteCharacterSheetPreset: (presetId: CharacterSheetPresetId) => Promise<boolean>;
};

export const useCharacterManagerPresetController = ({
  characterId,
  clearMessages,
  setError,
  setIsSavingCharacterSheetPreset,
  activeCharacterSheetPresetIdRef,
  activeCharacterSheetPresetRequestRef,
  characterSheetPresetsRef,
  visibleCharacterSheetPresetIdsRef,
  characterSheetPresetLabelsRef,
  characterSheetPresetDescriptionsRef,
  lastPersistedDescriptionMapRef,
  descriptionPersistTimerRefs,
  descriptionPersistRequestRef,
  characterSheetPresetAssignmentsRequestRef,
  characterSheetPresetTabOrderRequestRef,
  characterSheetPresetTabLabelRequestRef,
  setActiveCharacterSheetPresetIdState,
  setCharacterSheetPresets,
  setVisibleCharacterSheetPresetIds,
  setCharacterSheetPresetLabels,
  setCharacterSheetPresetDescriptions,
  setCharacterSheetPresetAssignments,
  setCharacterDescriptionState,
  toErrorMessage,
}: UseCharacterManagerPresetControllerParams): UseCharacterManagerPresetControllerResult => {
  const mergePersistedTabDescriptions = React.useCallback(
    (
      persistedDescriptions: CharacterSheetPresetDescriptionMap
    ): CharacterSheetPresetDescriptionMap => {
      const pendingPersistByPreset = CHARACTER_SHEET_PRESET_IDS.reduce(
        (acc, presetId) => {
          acc[presetId] = Boolean(descriptionPersistTimerRefs.current[presetId]);
          return acc;
        },
        {} as Record<CharacterSheetPresetId, boolean>
      );
      const mergedDescriptions = mergeCharacterSheetPresetTabDescriptions({
        persistedDescriptions,
        localDescriptions: characterSheetPresetDescriptionsRef.current,
        lastPersistedDescriptions: lastPersistedDescriptionMapRef.current,
        hasPendingPersist: pendingPersistByPreset,
      });
      setCharacterSheetPresetDescriptions(mergedDescriptions);
      characterSheetPresetDescriptionsRef.current = mergedDescriptions;
      return mergedDescriptions;
    },
    [
      characterSheetPresetDescriptionsRef,
      descriptionPersistTimerRefs,
      lastPersistedDescriptionMapRef,
      setCharacterSheetPresetDescriptions,
    ]
  );

  const applyPersistedPresetState = React.useCallback(
    ({
      persistedState,
      preserveLocalPresetReferences = false,
    }: {
      persistedState: PersistedPresetState;
      preserveLocalPresetReferences?: boolean;
    }) => {
      setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
      activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
      setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
      visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
      setCharacterSheetPresetLabels(persistedState.tabLabels);
      characterSheetPresetLabelsRef.current = persistedState.tabLabels;
      const mergedDescriptions = mergePersistedTabDescriptions(persistedState.tabDescriptions);
      lastPersistedDescriptionMapRef.current = persistedState.tabDescriptions;

      const resolvedPresets = preserveLocalPresetReferences
        ? characterSheetPresetsRef.current
        : persistedState.presets;
      if (!preserveLocalPresetReferences) {
        setCharacterSheetPresets(persistedState.presets);
        characterSheetPresetsRef.current = persistedState.presets;
      }

      setCharacterSheetPresetAssignments(
        resolvedPresets[persistedState.activePresetId] ??
          persistedState.presets[persistedState.activePresetId] ??
          createEmptyCharacterSheetPresetAssignments()
      );
      setCharacterDescriptionState(mergedDescriptions[persistedState.activePresetId] ?? "");
    },
    [
      activeCharacterSheetPresetIdRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetsRef,
      lastPersistedDescriptionMapRef,
      mergePersistedTabDescriptions,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresetLabels,
      setCharacterSheetPresets,
      setVisibleCharacterSheetPresetIds,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  const scheduleCharacterSheetPresetDescriptionPersist = React.useCallback(
    (presetId: CharacterSheetPresetId, description: string) => {
      if (!characterId) return;

      const nextDescription = description.slice(0, 150);
      if (nextDescription === (lastPersistedDescriptionMapRef.current[presetId] ?? "")) {
        return;
      }

      const timerId = descriptionPersistTimerRefs.current[presetId];
      if (timerId) {
        window.clearTimeout(timerId);
      }
      descriptionPersistTimerRefs.current[presetId] = window.setTimeout(() => {
        descriptionPersistTimerRefs.current[presetId] = null;
        const requestId = (descriptionPersistRequestRef.current[presetId] ?? 0) + 1;
        descriptionPersistRequestRef.current[presetId] = requestId;
        const rollbackDescription = lastPersistedDescriptionMapRef.current[presetId] ?? "";
        void saveCharacterManagerCharacterSheetPresetTabDescription({
          characterId,
          presetId,
          description: nextDescription,
        })
          .then((persistedState) => {
            if (descriptionPersistRequestRef.current[presetId] !== requestId) {
              return;
            }
            lastPersistedDescriptionMapRef.current = {
              ...lastPersistedDescriptionMapRef.current,
              [presetId]: persistedState.tabDescriptions[presetId] ?? "",
            };
            const mergedDescriptions = mergePersistedTabDescriptions(
              persistedState.tabDescriptions
            );
            setVisibleCharacterSheetPresetIds(persistedState.tabOrder);
            visibleCharacterSheetPresetIdsRef.current = persistedState.tabOrder;
            setCharacterSheetPresetLabels(persistedState.tabLabels);
            characterSheetPresetLabelsRef.current = persistedState.tabLabels;
            if (!persistedState.tabOrder.includes(activeCharacterSheetPresetIdRef.current)) {
              activeCharacterSheetPresetIdRef.current = persistedState.activePresetId;
              setActiveCharacterSheetPresetIdState(persistedState.activePresetId);
              setCharacterSheetPresetAssignments(
                characterSheetPresetsRef.current[persistedState.activePresetId] ??
                  createEmptyCharacterSheetPresetAssignments()
              );
            }
            setCharacterDescriptionState(
              mergedDescriptions[activeCharacterSheetPresetIdRef.current] ?? ""
            );
          })
          .catch((nextError) => {
            if (descriptionPersistRequestRef.current[presetId] !== requestId) {
              return;
            }
            const revertedDescriptions = {
              ...characterSheetPresetDescriptionsRef.current,
              [presetId]: rollbackDescription,
            };
            setCharacterSheetPresetDescriptions(revertedDescriptions);
            characterSheetPresetDescriptionsRef.current = revertedDescriptions;
            if (activeCharacterSheetPresetIdRef.current === presetId) {
              setCharacterDescriptionState(rollbackDescription);
            }
            setError(toErrorMessage(nextError, "Failed to save character description."));
          });
      }, 500);
    },
    [
      activeCharacterSheetPresetIdRef,
      characterId,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetsRef,
      descriptionPersistRequestRef,
      descriptionPersistTimerRefs,
      lastPersistedDescriptionMapRef,
      mergePersistedTabDescriptions,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresetDescriptions,
      setCharacterSheetPresetLabels,
      setError,
      setVisibleCharacterSheetPresetIds,
      toErrorMessage,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  const setCharacterDescription = React.useCallback(
    (value: string) => {
      const activePresetId = activeCharacterSheetPresetIdRef.current;
      const nextDescription = value.slice(0, 150);
      setCharacterDescriptionState(nextDescription);
      setCharacterSheetPresetDescriptions((prev) => {
        if (prev[activePresetId] === nextDescription) return prev;
        const nextDescriptions = {
          ...prev,
          [activePresetId]: nextDescription,
        };
        characterSheetPresetDescriptionsRef.current = nextDescriptions;
        scheduleCharacterSheetPresetDescriptionPersist(activePresetId, nextDescription);
        return nextDescriptions;
      });
    },
    [
      activeCharacterSheetPresetIdRef,
      characterSheetPresetDescriptionsRef,
      scheduleCharacterSheetPresetDescriptionPersist,
      setCharacterDescriptionState,
      setCharacterSheetPresetDescriptions,
    ]
  );

  const setActiveCharacterSheetPreset = React.useCallback(
    async (presetId: CharacterSheetPresetId) => {
      clearMessages();
      if (!characterId) {
        const nextAssignments =
          characterSheetPresetsRef.current[presetId] ??
          createEmptyCharacterSheetPresetAssignments();
        setActiveCharacterSheetPresetIdState(presetId);
        activeCharacterSheetPresetIdRef.current = presetId;
        setCharacterSheetPresetAssignments(nextAssignments);
        setCharacterDescriptionState(characterSheetPresetDescriptionsRef.current[presetId] ?? "");
        return true;
      }
      const previousPresetId = activeCharacterSheetPresetIdRef.current;
      const previousAssignments =
        characterSheetPresetsRef.current[previousPresetId] ??
        createEmptyCharacterSheetPresetAssignments();
      const previousDescription =
        characterSheetPresetDescriptionsRef.current[previousPresetId] ?? "";
      const nextDescription = characterSheetPresetDescriptionsRef.current[presetId] ?? "";
      setActiveCharacterSheetPresetIdState(presetId);
      activeCharacterSheetPresetIdRef.current = presetId;
      setCharacterSheetPresetAssignments(
        characterSheetPresetsRef.current[presetId] ?? createEmptyCharacterSheetPresetAssignments()
      );
      setCharacterDescriptionState(nextDescription);
      const requestId = activeCharacterSheetPresetRequestRef.current + 1;
      activeCharacterSheetPresetRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerActiveCharacterSheetPreset({
          characterId,
          presetId,
        });
        if (activeCharacterSheetPresetRequestRef.current !== requestId) {
          return true;
        }
        applyPersistedPresetState({
          persistedState,
          preserveLocalPresetReferences: true,
        });
        return true;
      } catch (nextError) {
        if (activeCharacterSheetPresetRequestRef.current !== requestId) {
          return false;
        }
        setActiveCharacterSheetPresetIdState(previousPresetId);
        activeCharacterSheetPresetIdRef.current = previousPresetId;
        setCharacterSheetPresetAssignments(previousAssignments);
        setCharacterDescriptionState(previousDescription);
        setError(toErrorMessage(nextError, "Failed to switch character look."));
        return false;
      } finally {
        if (activeCharacterSheetPresetRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      activeCharacterSheetPresetRequestRef,
      applyPersistedPresetState,
      characterId,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetsRef,
      clearMessages,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterSheetPresetAssignments,
      setError,
      setIsSavingCharacterSheetPreset,
      toErrorMessage,
    ]
  );

  const saveCharacterSheetPresetAssignments = React.useCallback(
    async (assignments: CharacterSheetPresetAssignments) => {
      clearMessages();
      const activePresetId = activeCharacterSheetPresetIdRef.current;
      const previousPresets = characterSheetPresetsRef.current;
      const previousAssignments =
        previousPresets[activePresetId] ?? createEmptyCharacterSheetPresetAssignments();
      const normalizedAssignments = { ...assignments };
      const optimisticPresets = {
        ...previousPresets,
        [activePresetId]: normalizedAssignments,
      };
      setCharacterSheetPresets(optimisticPresets);
      characterSheetPresetsRef.current = optimisticPresets;
      setCharacterSheetPresetAssignments(normalizedAssignments);
      if (!characterId) {
        return true;
      }

      const requestId = characterSheetPresetAssignmentsRequestRef.current + 1;
      characterSheetPresetAssignmentsRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerCharacterSheetPresetAssignments({
          characterId,
          presetId: activePresetId,
          assignments: normalizedAssignments,
        });
        if (characterSheetPresetAssignmentsRequestRef.current !== requestId) {
          return true;
        }
        applyPersistedPresetState({ persistedState });
        return true;
      } catch (nextError) {
        if (characterSheetPresetAssignmentsRequestRef.current !== requestId) {
          return false;
        }
        const revertedPresets = {
          ...previousPresets,
          [activePresetId]: previousAssignments,
        };
        setCharacterSheetPresets(revertedPresets);
        characterSheetPresetsRef.current = revertedPresets;
        setCharacterSheetPresetAssignments(previousAssignments);
        setError(toErrorMessage(nextError, "Failed to save character look."));
        return false;
      } finally {
        if (characterSheetPresetAssignmentsRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      applyPersistedPresetState,
      characterId,
      characterSheetPresetAssignmentsRequestRef,
      characterSheetPresetsRef,
      clearMessages,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresets,
      setError,
      setIsSavingCharacterSheetPreset,
      toErrorMessage,
    ]
  );

  const addCharacterSheetPreset = React.useCallback(async () => {
    clearMessages();
    const previousPresetId = activeCharacterSheetPresetIdRef.current;
    const previousVisiblePresetIds = [...visibleCharacterSheetPresetIdsRef.current];
    const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
    const previousPresetDescriptions = { ...characterSheetPresetDescriptionsRef.current };
    const previousAssignments =
      characterSheetPresetsRef.current[previousPresetId] ??
      createEmptyCharacterSheetPresetAssignments();
    const nextPresetId = getNextCharacterSheetPresetId(previousVisiblePresetIds);
    if (!nextPresetId) {
      setError("You can create up to 10 looks.");
      return false;
    }

    const optimisticVisiblePresetIds = [...previousVisiblePresetIds, nextPresetId];
    const optimisticLabels = {
      ...previousPresetLabels,
      [nextPresetId]: previousPresetLabels[nextPresetId] ?? nextPresetId,
    };
    const optimisticDescriptions = {
      ...previousPresetDescriptions,
      [nextPresetId]: previousPresetDescriptions[nextPresetId] ?? "",
    };
    setVisibleCharacterSheetPresetIds(optimisticVisiblePresetIds);
    visibleCharacterSheetPresetIdsRef.current = optimisticVisiblePresetIds;
    setCharacterSheetPresetLabels(optimisticLabels);
    characterSheetPresetLabelsRef.current = optimisticLabels;
    setCharacterSheetPresetDescriptions(optimisticDescriptions);
    characterSheetPresetDescriptionsRef.current = optimisticDescriptions;
    setActiveCharacterSheetPresetIdState(nextPresetId);
    activeCharacterSheetPresetIdRef.current = nextPresetId;
    setCharacterSheetPresetAssignments(
      characterSheetPresetsRef.current[nextPresetId] ?? createEmptyCharacterSheetPresetAssignments()
    );
    setCharacterDescriptionState(optimisticDescriptions[nextPresetId] ?? "");
    if (!characterId) {
      return true;
    }

    const requestId = characterSheetPresetTabOrderRequestRef.current + 1;
    characterSheetPresetTabOrderRequestRef.current = requestId;
    setIsSavingCharacterSheetPreset(true);
    try {
      const persistedState = await saveCharacterManagerCharacterSheetPresetTabOrder({
        characterId,
        tabOrder: optimisticVisiblePresetIds,
        activePresetId: nextPresetId,
      });
      if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
        return true;
      }
      applyPersistedPresetState({ persistedState });
      return true;
    } catch (nextError) {
      if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
        return false;
      }
      setVisibleCharacterSheetPresetIds(previousVisiblePresetIds);
      visibleCharacterSheetPresetIdsRef.current = previousVisiblePresetIds;
      setCharacterSheetPresetLabels(previousPresetLabels);
      characterSheetPresetLabelsRef.current = previousPresetLabels;
      setCharacterSheetPresetDescriptions(previousPresetDescriptions);
      characterSheetPresetDescriptionsRef.current = previousPresetDescriptions;
      setActiveCharacterSheetPresetIdState(previousPresetId);
      activeCharacterSheetPresetIdRef.current = previousPresetId;
      setCharacterSheetPresetAssignments(previousAssignments);
      setCharacterDescriptionState(previousPresetDescriptions[previousPresetId] ?? "");
      setError(toErrorMessage(nextError, "Failed to add character look."));
      return false;
    } finally {
      if (characterSheetPresetTabOrderRequestRef.current === requestId) {
        setIsSavingCharacterSheetPreset(false);
      }
    }
  }, [
    activeCharacterSheetPresetIdRef,
    applyPersistedPresetState,
    characterId,
    characterSheetPresetDescriptionsRef,
    characterSheetPresetLabelsRef,
    characterSheetPresetTabOrderRequestRef,
    characterSheetPresetsRef,
    clearMessages,
    setActiveCharacterSheetPresetIdState,
    setCharacterDescriptionState,
    setCharacterSheetPresetAssignments,
    setCharacterSheetPresetDescriptions,
    setCharacterSheetPresetLabels,
    setError,
    setIsSavingCharacterSheetPreset,
    setVisibleCharacterSheetPresetIds,
    toErrorMessage,
    visibleCharacterSheetPresetIdsRef,
  ]);

  const renameCharacterSheetPreset = React.useCallback(
    async (presetId: CharacterSheetPresetId, nextLabel: string) => {
      clearMessages();
      if (!visibleCharacterSheetPresetIdsRef.current.includes(presetId)) {
        return false;
      }

      const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
      const optimisticLabel = sanitizeCharacterSheetPresetTabLabel({
        presetId,
        label: nextLabel,
      });
      const optimisticLabels = {
        ...previousPresetLabels,
        [presetId]: optimisticLabel,
      };
      setCharacterSheetPresetLabels(optimisticLabels);
      characterSheetPresetLabelsRef.current = optimisticLabels;
      if (!characterId) {
        return true;
      }

      const requestId = characterSheetPresetTabLabelRequestRef.current + 1;
      characterSheetPresetTabLabelRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await saveCharacterManagerCharacterSheetPresetTabLabel({
          characterId,
          presetId,
          label: optimisticLabel,
        });
        if (characterSheetPresetTabLabelRequestRef.current !== requestId) {
          return true;
        }
        applyPersistedPresetState({ persistedState });
        return true;
      } catch (nextError) {
        if (characterSheetPresetTabLabelRequestRef.current !== requestId) {
          return false;
        }
        setCharacterSheetPresetLabels(previousPresetLabels);
        characterSheetPresetLabelsRef.current = previousPresetLabels;
        setError(toErrorMessage(nextError, "Failed to rename look."));
        return false;
      } finally {
        if (characterSheetPresetTabLabelRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [
      applyPersistedPresetState,
      characterId,
      characterSheetPresetLabelsRef,
      characterSheetPresetTabLabelRequestRef,
      clearMessages,
      setCharacterSheetPresetLabels,
      setError,
      setIsSavingCharacterSheetPreset,
      toErrorMessage,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  const deleteCharacterSheetPreset = React.useCallback(
    async (presetId: CharacterSheetPresetId) => {
      clearMessages();
      if (presetId === "1") {
        setError("Look 1 cannot be deleted.");
        return false;
      }

      const previousPresetId = activeCharacterSheetPresetIdRef.current;
      const previousPresets = characterSheetPresetsRef.current;
      const previousVisiblePresetIds = [...visibleCharacterSheetPresetIdsRef.current];
      const previousPresetLabels = { ...characterSheetPresetLabelsRef.current };
      const previousPresetDescriptions = { ...characterSheetPresetDescriptionsRef.current };
      if (!previousVisiblePresetIds.includes(presetId)) {
        return false;
      }

      const optimisticVisiblePresetIds = previousVisiblePresetIds.filter(
        (visiblePresetId) => visiblePresetId !== presetId
      );
      if (!optimisticVisiblePresetIds.length) {
        setError("At least one look must remain visible.");
        return false;
      }

      const deletedPresetIndex = previousVisiblePresetIds.indexOf(presetId);
      const nearestLeftPresetId =
        deletedPresetIndex > 0 ? (previousVisiblePresetIds[deletedPresetIndex - 1] ?? null) : null;
      const nearestRightPresetId =
        deletedPresetIndex >= 0 ? (previousVisiblePresetIds[deletedPresetIndex + 1] ?? null) : null;
      const nextActivePresetId =
        previousPresetId === presetId
          ? (nearestLeftPresetId ?? nearestRightPresetId ?? optimisticVisiblePresetIds[0] ?? "1")
          : previousPresetId;
      const optimisticPresets = {
        ...previousPresets,
        [presetId]: createEmptyCharacterSheetPresetAssignments(),
      };
      const optimisticLabels = {
        ...previousPresetLabels,
        [presetId]: presetId,
      };
      const optimisticDescriptions = {
        ...previousPresetDescriptions,
        [presetId]: "",
      };
      const previousActiveAssignments =
        previousPresets[previousPresetId] ?? createEmptyCharacterSheetPresetAssignments();
      const nextActiveAssignments =
        optimisticPresets[nextActivePresetId] ?? createEmptyCharacterSheetPresetAssignments();

      setCharacterSheetPresets(optimisticPresets);
      characterSheetPresetsRef.current = optimisticPresets;
      setVisibleCharacterSheetPresetIds(optimisticVisiblePresetIds);
      visibleCharacterSheetPresetIdsRef.current = optimisticVisiblePresetIds;
      setCharacterSheetPresetLabels(optimisticLabels);
      characterSheetPresetLabelsRef.current = optimisticLabels;
      setCharacterSheetPresetDescriptions(optimisticDescriptions);
      characterSheetPresetDescriptionsRef.current = optimisticDescriptions;
      setActiveCharacterSheetPresetIdState(nextActivePresetId);
      activeCharacterSheetPresetIdRef.current = nextActivePresetId;
      setCharacterSheetPresetAssignments(nextActiveAssignments);
      setCharacterDescriptionState(optimisticDescriptions[nextActivePresetId] ?? "");
      if (!characterId) {
        return true;
      }

      const requestId = characterSheetPresetTabOrderRequestRef.current + 1;
      characterSheetPresetTabOrderRequestRef.current = requestId;
      setIsSavingCharacterSheetPreset(true);
      try {
        const persistedState = await deleteCharacterManagerCharacterSheetPreset({
          characterId,
          presetId,
          nextTabOrder: optimisticVisiblePresetIds,
          nextActivePresetId,
        });
        if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
          return true;
        }
        applyPersistedPresetState({ persistedState });
        return true;
      } catch (nextError) {
        if (characterSheetPresetTabOrderRequestRef.current !== requestId) {
          return false;
        }
        setCharacterSheetPresets(previousPresets);
        characterSheetPresetsRef.current = previousPresets;
        setVisibleCharacterSheetPresetIds(previousVisiblePresetIds);
        visibleCharacterSheetPresetIdsRef.current = previousVisiblePresetIds;
        setCharacterSheetPresetLabels(previousPresetLabels);
        characterSheetPresetLabelsRef.current = previousPresetLabels;
        setCharacterSheetPresetDescriptions(previousPresetDescriptions);
        characterSheetPresetDescriptionsRef.current = previousPresetDescriptions;
        setActiveCharacterSheetPresetIdState(previousPresetId);
        activeCharacterSheetPresetIdRef.current = previousPresetId;
        setCharacterSheetPresetAssignments(previousActiveAssignments);
        setCharacterDescriptionState(previousPresetDescriptions[previousPresetId] ?? "");
        setError(toErrorMessage(nextError, "Failed to delete look."));
        return false;
      } finally {
        if (characterSheetPresetTabOrderRequestRef.current === requestId) {
          setIsSavingCharacterSheetPreset(false);
        }
      }
    },
    [
      activeCharacterSheetPresetIdRef,
      applyPersistedPresetState,
      characterId,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetTabOrderRequestRef,
      characterSheetPresetsRef,
      clearMessages,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresetDescriptions,
      setCharacterSheetPresetLabels,
      setCharacterSheetPresets,
      setError,
      setIsSavingCharacterSheetPreset,
      setVisibleCharacterSheetPresetIds,
      toErrorMessage,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  return {
    setCharacterDescription,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
  };
};
