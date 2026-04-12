/**
 * Character Manager bootstrap controller.
 * Owns scoped bootstrap loading, snapshot application, and best-effort character list refresh.
 */
import React from "react";
import { readSupabaseUserId } from "../../../lib/supabaseClient";
import {
  CHARACTER_SHEET_PRESET_IDS,
  createDefaultCharacterSheetPresetState,
  createEmptyCharacterSheetAssignments,
  createEmptyCharacterSlotMap,
} from "../constants";
import {
  listCharacterManagerCharacters,
  loadLatestCharacterManagerDraft,
  type CharacterManagerListItem,
} from "../logic/characterManagerPersistence";
import {
  publishCharacterListChanged,
  type CharacterListChangeReason,
} from "../logic/characterListSyncEvents";
import {
  persistSelectedCharacterId,
  readPersistedSelectedCharacterId,
} from "../logic/selectedCharacterPersistence";
import type {
  CharacterProfileImageTransform,
  CharacterReferenceSlotKey,
  CharacterSheetAssignments,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetDescriptionMap,
  CharacterSheetPresetId,
  CharacterSheetPresetState,
  CharacterSlotFileMap,
} from "../types";

const DEFAULT_LOCAL_CHARACTER_NAME = "New Character";
const DEFAULT_LOCAL_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
};

type ApplySnapshotInput = {
  nextCharacterId: string;
  nextCharacterSheetId: string;
  nextCharacterName: string;
  nextCharacterDescription: string;
  nextCharacterSheetAssignments: CharacterSheetAssignments;
  nextActiveCharacterSheetPresetId: CharacterSheetPresetId;
  nextCharacterSheetPresets: CharacterSheetPresetState["presets"];
  nextVisibleCharacterSheetPresetIds: CharacterSheetPresetState["tabOrder"];
  nextCharacterSheetPresetLabels: CharacterSheetPresetState["tabLabels"];
  nextCharacterSheetPresetDescriptions: CharacterSheetPresetDescriptionMap;
  nextCharacterSheetPresetAssignments: CharacterSheetPresetAssignments;
  nextProfileImageUrl: string | null;
  nextProfileImageTransform: CharacterProfileImageTransform;
  nextSlots: CharacterSlotFileMap;
  nextUserId: string;
};

type UseCharacterManagerBootstrapControllerParams = {
  setCharacters: React.Dispatch<React.SetStateAction<CharacterManagerListItem[]>>;
  setCharacterId: React.Dispatch<React.SetStateAction<string | null>>;
  setCharacterSheetId: React.Dispatch<React.SetStateAction<string | null>>;
  setCharacterNameState: React.Dispatch<React.SetStateAction<string>>;
  setCharacterDescriptionState: React.Dispatch<React.SetStateAction<string>>;
  setCharacterSheetAssignments: React.Dispatch<React.SetStateAction<CharacterSheetAssignments>>;
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
  setProfileImageUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setProfileImageTransform: React.Dispatch<React.SetStateAction<CharacterProfileImageTransform>>;
  setSlots: React.Dispatch<React.SetStateAction<CharacterSlotFileMap>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSlotBusyKeys: React.Dispatch<React.SetStateAction<Set<CharacterReferenceSlotKey>>>;
  suppressNextNamePersistRef: React.MutableRefObject<boolean>;
  selectedCharacterStorageScopeRef: React.MutableRefObject<string | null>;
  characterSheetAssignmentsRef: React.MutableRefObject<CharacterSheetAssignments>;
  characterSheetAssignmentsRequestRef: React.MutableRefObject<number>;
  activeCharacterSheetPresetIdRef: React.MutableRefObject<CharacterSheetPresetId>;
  characterSheetPresetsRef: React.MutableRefObject<CharacterSheetPresetState["presets"]>;
  visibleCharacterSheetPresetIdsRef: React.MutableRefObject<CharacterSheetPresetState["tabOrder"]>;
  characterSheetPresetLabelsRef: React.MutableRefObject<CharacterSheetPresetState["tabLabels"]>;
  characterSheetPresetDescriptionsRef: React.MutableRefObject<CharacterSheetPresetDescriptionMap>;
  characterSheetPresetAssignmentsRequestRef: React.MutableRefObject<number>;
  lastPersistedNameRef: React.MutableRefObject<string>;
  lastPersistedDescriptionMapRef: React.MutableRefObject<CharacterSheetPresetDescriptionMap>;
  descriptionPersistRequestRef: React.MutableRefObject<Record<CharacterSheetPresetId, number>>;
  descriptionPersistTimerRefs: React.MutableRefObject<
    Record<CharacterSheetPresetId, number | null>
  >;
  createPresetRequestCounterMap: () => Record<CharacterSheetPresetId, number>;
  slotsRef: React.MutableRefObject<CharacterSlotFileMap>;
  toErrorMessage: (error: unknown, fallback: string) => string;
};

type UseCharacterManagerBootstrapControllerResult = {
  applySnapshot: (input: ApplySnapshotInput) => void;
  applyLocalDraft: (input: {
    nextUserId: string | null;
    preservePersistedSelection?: boolean;
  }) => void;
  refreshCharacterList: (
    preferredCharacterId?: string | null,
    options?: {
      publishSyncEvent?: boolean;
      reason?: CharacterListChangeReason;
    }
  ) => Promise<string | null>;
  refreshCharacterListSilently: (
    preferredCharacterId?: string | null,
    options?: {
      publishSyncEvent?: boolean;
      reason?: CharacterListChangeReason;
    }
  ) => Promise<void>;
};

export const useCharacterManagerBootstrapController = ({
  setCharacters,
  setCharacterId,
  setCharacterSheetId,
  setCharacterNameState,
  setCharacterDescriptionState,
  setCharacterSheetAssignments,
  setActiveCharacterSheetPresetIdState,
  setCharacterSheetPresets,
  setVisibleCharacterSheetPresetIds,
  setCharacterSheetPresetLabels,
  setCharacterSheetPresetDescriptions,
  setCharacterSheetPresetAssignments,
  setProfileImageUrl,
  setProfileImageTransform,
  setSlots,
  setError,
  setLoading,
  setSlotBusyKeys,
  suppressNextNamePersistRef,
  selectedCharacterStorageScopeRef,
  characterSheetAssignmentsRef,
  characterSheetAssignmentsRequestRef,
  activeCharacterSheetPresetIdRef,
  characterSheetPresetsRef,
  visibleCharacterSheetPresetIdsRef,
  characterSheetPresetLabelsRef,
  characterSheetPresetDescriptionsRef,
  characterSheetPresetAssignmentsRequestRef,
  lastPersistedNameRef,
  lastPersistedDescriptionMapRef,
  descriptionPersistRequestRef,
  descriptionPersistTimerRefs,
  createPresetRequestCounterMap,
  slotsRef,
  toErrorMessage,
}: UseCharacterManagerBootstrapControllerParams): UseCharacterManagerBootstrapControllerResult => {
  const refreshCharacterList = React.useCallback(
    async (
      preferredCharacterId?: string | null,
      options?: {
        publishSyncEvent?: boolean;
        reason?: CharacterListChangeReason;
      }
    ) => {
      const items = await listCharacterManagerCharacters();
      setCharacters(items);
      if (options?.publishSyncEvent) {
        publishCharacterListChanged({
          userId: selectedCharacterStorageScopeRef.current,
          reason: options.reason ?? "refresh",
        });
      }
      if (!items.length) return null;

      const preferredId = preferredCharacterId?.trim();
      if (preferredId && items.some((item) => item.characterId === preferredId)) {
        return preferredId;
      }
      return items[0]?.characterId ?? null;
    },
    [selectedCharacterStorageScopeRef, setCharacters]
  );

  const refreshCharacterListSilently = React.useCallback(
    async (
      preferredCharacterId?: string | null,
      options?: {
        publishSyncEvent?: boolean;
        reason?: CharacterListChangeReason;
      }
    ) => {
      try {
        await refreshCharacterList(preferredCharacterId, options);
      } catch {
        // Character rail refresh is best-effort and should not break core draft actions.
      }
    },
    [refreshCharacterList]
  );

  const applySnapshot = React.useCallback(
    ({
      nextCharacterId,
      nextCharacterSheetId,
      nextCharacterName,
      nextCharacterDescription,
      nextCharacterSheetAssignments,
      nextActiveCharacterSheetPresetId,
      nextCharacterSheetPresets,
      nextVisibleCharacterSheetPresetIds,
      nextCharacterSheetPresetLabels,
      nextCharacterSheetPresetDescriptions,
      nextCharacterSheetPresetAssignments,
      nextProfileImageUrl,
      nextProfileImageTransform,
      nextSlots,
      nextUserId,
    }: ApplySnapshotInput) => {
      setCharacterId(nextCharacterId);
      selectedCharacterStorageScopeRef.current = nextUserId;
      persistSelectedCharacterId(nextCharacterId, { userId: nextUserId });
      setCharacterSheetId(nextCharacterSheetId);
      suppressNextNamePersistRef.current = true;
      setCharacterNameState(nextCharacterName);
      setCharacterDescriptionState(nextCharacterDescription);
      setCharacterSheetAssignments(nextCharacterSheetAssignments);
      characterSheetAssignmentsRef.current = nextCharacterSheetAssignments;
      characterSheetAssignmentsRequestRef.current = 0;
      setActiveCharacterSheetPresetIdState(nextActiveCharacterSheetPresetId);
      activeCharacterSheetPresetIdRef.current = nextActiveCharacterSheetPresetId;
      setCharacterSheetPresets(nextCharacterSheetPresets);
      characterSheetPresetsRef.current = nextCharacterSheetPresets;
      setVisibleCharacterSheetPresetIds(nextVisibleCharacterSheetPresetIds);
      visibleCharacterSheetPresetIdsRef.current = nextVisibleCharacterSheetPresetIds;
      setCharacterSheetPresetLabels(nextCharacterSheetPresetLabels);
      characterSheetPresetLabelsRef.current = nextCharacterSheetPresetLabels;
      setCharacterSheetPresetDescriptions(nextCharacterSheetPresetDescriptions);
      characterSheetPresetDescriptionsRef.current = nextCharacterSheetPresetDescriptions;
      setCharacterSheetPresetAssignments(nextCharacterSheetPresetAssignments);
      characterSheetPresetAssignmentsRequestRef.current = 0;
      setProfileImageUrl(nextProfileImageUrl);
      setProfileImageTransform(nextProfileImageTransform);
      setSlots(nextSlots);
      slotsRef.current = nextSlots;
      lastPersistedNameRef.current = nextCharacterName.trim();
      lastPersistedDescriptionMapRef.current = nextCharacterSheetPresetDescriptions;
      descriptionPersistRequestRef.current = createPresetRequestCounterMap();
      for (const presetId of CHARACTER_SHEET_PRESET_IDS) {
        const timerId = descriptionPersistTimerRefs.current[presetId];
        if (timerId) {
          window.clearTimeout(timerId);
          descriptionPersistTimerRefs.current[presetId] = null;
        }
      }
      setSlotBusyKeys(new Set());
    },
    [
      activeCharacterSheetPresetIdRef,
      characterSheetAssignmentsRef,
      characterSheetAssignmentsRequestRef,
      characterSheetPresetAssignmentsRequestRef,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetsRef,
      createPresetRequestCounterMap,
      descriptionPersistRequestRef,
      descriptionPersistTimerRefs,
      lastPersistedDescriptionMapRef,
      lastPersistedNameRef,
      selectedCharacterStorageScopeRef,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterId,
      setCharacterNameState,
      setCharacterSheetAssignments,
      setCharacterSheetId,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresetDescriptions,
      setCharacterSheetPresetLabels,
      setCharacterSheetPresets,
      setProfileImageTransform,
      setProfileImageUrl,
      setSlotBusyKeys,
      setSlots,
      setVisibleCharacterSheetPresetIds,
      slotsRef,
      suppressNextNamePersistRef,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  const applyLocalDraft = React.useCallback(
    ({
      nextUserId,
      preservePersistedSelection = false,
    }: {
      nextUserId: string | null;
      preservePersistedSelection?: boolean;
    }) => {
      const presetState = createDefaultCharacterSheetPresetState();
      const activePresetId = presetState.activePresetId;
      setCharacterId(null);
      selectedCharacterStorageScopeRef.current = nextUserId;
      if (!preservePersistedSelection) {
        persistSelectedCharacterId(null, nextUserId ? { userId: nextUserId } : undefined);
      }
      setCharacterSheetId(null);
      suppressNextNamePersistRef.current = true;
      setCharacterNameState(DEFAULT_LOCAL_CHARACTER_NAME);
      setCharacterDescriptionState(presetState.tabDescriptions[activePresetId] ?? "");
      const emptyAssignments = createEmptyCharacterSheetAssignments();
      setCharacterSheetAssignments(emptyAssignments);
      characterSheetAssignmentsRef.current = emptyAssignments;
      characterSheetAssignmentsRequestRef.current = 0;
      setActiveCharacterSheetPresetIdState(activePresetId);
      activeCharacterSheetPresetIdRef.current = activePresetId;
      setCharacterSheetPresets(presetState.presets);
      characterSheetPresetsRef.current = presetState.presets;
      setVisibleCharacterSheetPresetIds(presetState.tabOrder);
      visibleCharacterSheetPresetIdsRef.current = presetState.tabOrder;
      setCharacterSheetPresetLabels(presetState.tabLabels);
      characterSheetPresetLabelsRef.current = presetState.tabLabels;
      setCharacterSheetPresetDescriptions(presetState.tabDescriptions);
      characterSheetPresetDescriptionsRef.current = presetState.tabDescriptions;
      setCharacterSheetPresetAssignments(presetState.presets[activePresetId]);
      characterSheetPresetAssignmentsRequestRef.current = 0;
      setProfileImageUrl(null);
      setProfileImageTransform(DEFAULT_LOCAL_PROFILE_IMAGE_TRANSFORM);
      const emptySlots = createEmptyCharacterSlotMap();
      setSlots(emptySlots);
      slotsRef.current = emptySlots;
      lastPersistedNameRef.current = DEFAULT_LOCAL_CHARACTER_NAME;
      lastPersistedDescriptionMapRef.current = presetState.tabDescriptions;
      descriptionPersistRequestRef.current = createPresetRequestCounterMap();
      for (const presetId of CHARACTER_SHEET_PRESET_IDS) {
        const timerId = descriptionPersistTimerRefs.current[presetId];
        if (timerId) {
          window.clearTimeout(timerId);
          descriptionPersistTimerRefs.current[presetId] = null;
        }
      }
      setSlotBusyKeys(new Set());
    },
    [
      activeCharacterSheetPresetIdRef,
      characterSheetAssignmentsRef,
      characterSheetAssignmentsRequestRef,
      characterSheetPresetAssignmentsRequestRef,
      characterSheetPresetDescriptionsRef,
      characterSheetPresetLabelsRef,
      characterSheetPresetsRef,
      createPresetRequestCounterMap,
      descriptionPersistRequestRef,
      descriptionPersistTimerRefs,
      lastPersistedDescriptionMapRef,
      lastPersistedNameRef,
      selectedCharacterStorageScopeRef,
      setActiveCharacterSheetPresetIdState,
      setCharacterDescriptionState,
      setCharacterId,
      setCharacterNameState,
      setCharacterSheetAssignments,
      setCharacterSheetId,
      setCharacterSheetPresetAssignments,
      setCharacterSheetPresetDescriptions,
      setCharacterSheetPresetLabels,
      setCharacterSheetPresets,
      setProfileImageTransform,
      setProfileImageUrl,
      setSlotBusyKeys,
      setSlots,
      setVisibleCharacterSheetPresetIds,
      slotsRef,
      suppressNextNamePersistRef,
      visibleCharacterSheetPresetIdsRef,
    ]
  );

  React.useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      try {
        const scopedUserId = (await readSupabaseUserId())?.trim() ?? null;
        selectedCharacterStorageScopeRef.current = scopedUserId;
        const preferredCharacterId = readPersistedSelectedCharacterId(
          scopedUserId ? { userId: scopedUserId } : undefined
        );
        const snapshot = await loadLatestCharacterManagerDraft(preferredCharacterId);
        if (!active) return;
        if (snapshot) {
          applySnapshot({
            nextCharacterId: snapshot.characterId,
            nextCharacterSheetId: snapshot.characterSheetId,
            nextCharacterName: snapshot.characterName,
            nextCharacterDescription: snapshot.characterDescription,
            nextCharacterSheetAssignments: snapshot.characterSheetAssignments,
            nextActiveCharacterSheetPresetId: snapshot.activeCharacterSheetPresetId,
            nextCharacterSheetPresets: snapshot.characterSheetPresets,
            nextVisibleCharacterSheetPresetIds: snapshot.visibleCharacterSheetPresetIds,
            nextCharacterSheetPresetLabels: snapshot.characterSheetPresetLabels,
            nextCharacterSheetPresetDescriptions: snapshot.characterSheetPresetDescriptions,
            nextCharacterSheetPresetAssignments: snapshot.characterSheetPresetAssignments,
            nextProfileImageUrl: snapshot.profileImageUrl,
            nextProfileImageTransform: snapshot.profileImageTransform,
            nextSlots: snapshot.slots,
            nextUserId: snapshot.userId,
          });
          await refreshCharacterListSilently(snapshot.characterId);
        } else {
          await refreshCharacterListSilently(null);
          if (!active) return;
          applyLocalDraft({
            nextUserId: scopedUserId,
          });
        }
      } catch (nextError) {
        if (!active) return;
        setError(toErrorMessage(nextError, "Failed to load Character Manager draft."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void bootstrap();
    return () => {
      active = false;
    };
  }, [
    applyLocalDraft,
    applySnapshot,
    refreshCharacterListSilently,
    selectedCharacterStorageScopeRef,
    setError,
    setLoading,
    toErrorMessage,
  ]);

  return {
    applySnapshot,
    applyLocalDraft,
    refreshCharacterList,
    refreshCharacterListSilently,
  };
};
