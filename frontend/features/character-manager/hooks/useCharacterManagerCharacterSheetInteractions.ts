import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import {
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
} from "../../../lib/internalReferenceDragPayload";
import { CHARACTER_SHEET_DROP_ZONES } from "../constants";
import { hasDroppedImageReferenceTransfer } from "../logic/characterDropPayload";
import type {
  CharacterQuickSwapItem,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
} from "../types";

type UseCharacterManagerCharacterSheetInteractionsParams = {
  pageBusy: boolean;
  isDropResolutionBusy: boolean;
  selectedCharacterId: string | null;
  pendingCharacterSheetUploadZoneKey: CharacterSheetDropZoneKey | null;
  setPendingCharacterSheetUploadZoneKey: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<unknown>;
  resolvedCharacterSheetPresetAssignments: CharacterSheetPresetAssignments;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<unknown>;
  quickSwapItemById: Map<string, CharacterQuickSwapItem>;
  quickSwapItemByMediaFileId: Map<string, CharacterQuickSwapItem>;
  quickSwapItemByLegacySlotKey: Map<string, CharacterQuickSwapItem>;
  draggedQuickSwapItemId: string | null;
  draggedCharacterSheetZoneKey: CharacterSheetDropZoneKey | null;
  canResolveCharacterDropReference: boolean;
  handleCharacterSheetReferenceDrop: (
    zoneKey: CharacterSheetDropZoneKey,
    transfer: DataTransfer
  ) => Promise<void>;
  setActiveCharacterSheetDropZone: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  openCharacterSheetPicker: (dropZoneKey: CharacterSheetDropZoneKey) => void;
  referenceSlotMimeType: string;
  characterSheetZoneMimeType: string;
};

type UseCharacterManagerCharacterSheetInteractionsResult = {
  handleCharacterSheetFileSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCharacterSheetDragOver: (
    characterSheetSlotKey: CharacterSheetDropZoneKey
  ) => (event: DragEvent<HTMLElement>) => void;
  clearCharacterSheetAssignment: (characterSheetSlotKey: CharacterSheetDropZoneKey) => void;
  handleCharacterSheetDrop: (
    characterSheetSlotKey: CharacterSheetDropZoneKey
  ) => (event: DragEvent<HTMLElement>) => void;
  handleCharacterSheetCardClick: (dropZoneKey: CharacterSheetDropZoneKey) => () => void;
};

export const useCharacterManagerCharacterSheetInteractions = ({
  pageBusy,
  isDropResolutionBusy,
  selectedCharacterId,
  pendingCharacterSheetUploadZoneKey,
  setPendingCharacterSheetUploadZoneKey,
  setCharacterSheetPresetFile,
  resolvedCharacterSheetPresetAssignments,
  saveCharacterSheetPresetAssignments,
  quickSwapItemById,
  quickSwapItemByMediaFileId,
  quickSwapItemByLegacySlotKey,
  draggedQuickSwapItemId,
  draggedCharacterSheetZoneKey,
  canResolveCharacterDropReference,
  handleCharacterSheetReferenceDrop,
  setActiveCharacterSheetDropZone,
  openCharacterSheetPicker,
  referenceSlotMimeType,
  characterSheetZoneMimeType,
}: UseCharacterManagerCharacterSheetInteractionsParams): UseCharacterManagerCharacterSheetInteractionsResult => {
  const persistCharacterSheetPresetAssignments = useCallback(
    (nextAssignments: CharacterSheetPresetAssignments) => {
      if (!selectedCharacterId) return;
      void saveCharacterSheetPresetAssignments(nextAssignments);
    },
    [saveCharacterSheetPresetAssignments, selectedCharacterId]
  );

  const assignReferenceToCharacterSheetSlot = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey, quickSwapItemId: string) => {
      if (!selectedCharacterId) return;
      const referenceEntry = quickSwapItemById.get(quickSwapItemId);
      if (!referenceEntry) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: {
          characterMediaId: referenceEntry.characterMediaId,
          storagePath: referenceEntry.storagePath,
          previewStoragePath: referenceEntry.previewStoragePath ?? null,
          previewUrl: referenceEntry.previewUrl,
        },
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [
      persistCharacterSheetPresetAssignments,
      quickSwapItemById,
      resolvedCharacterSheetPresetAssignments,
      selectedCharacterId,
    ]
  );

  const handleCharacterSheetFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      const targetDropZone = pendingCharacterSheetUploadZoneKey;
      setPendingCharacterSheetUploadZoneKey(null);

      if (!file || !targetDropZone || pageBusy) return;
      void setCharacterSheetPresetFile(targetDropZone, file);
    },
    [
      pageBusy,
      pendingCharacterSheetUploadZoneKey,
      setCharacterSheetPresetFile,
      setPendingCharacterSheetUploadZoneKey,
    ]
  );

  const resolveDraggedQuickSwapItem = useCallback(
    (transfer: DataTransfer): CharacterQuickSwapItem | null => {
      const rawPayload = transfer.getData("application/x-shortpulse-quickswap-item");
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as { id?: string };
          const parsedId = parsed.id?.trim();
          if (parsedId && quickSwapItemById.has(parsedId)) {
            return quickSwapItemById.get(parsedId) ?? null;
          }
        } catch {
          // Ignore malformed payload and continue with compatibility fallbacks.
        }
      }
      const mediaId =
        transfer.getData(referenceSlotMimeType)?.trim() ||
        transfer.getData("text/plain")?.trim() ||
        "";
      if (!mediaId) {
        return draggedQuickSwapItemId
          ? (quickSwapItemById.get(draggedQuickSwapItemId) ?? null)
          : null;
      }
      if (quickSwapItemByMediaFileId.has(mediaId)) {
        return quickSwapItemByMediaFileId.get(mediaId) ?? null;
      }
      if (quickSwapItemByLegacySlotKey.has(mediaId)) {
        return quickSwapItemByLegacySlotKey.get(mediaId) ?? null;
      }
      return draggedQuickSwapItemId
        ? (quickSwapItemById.get(draggedQuickSwapItemId) ?? null)
        : null;
    },
    [
      draggedQuickSwapItemId,
      quickSwapItemById,
      quickSwapItemByLegacySlotKey,
      quickSwapItemByMediaFileId,
      referenceSlotMimeType,
    ]
  );

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: DragEvent<HTMLElement>) => {
      if (pageBusy || isDropResolutionBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(characterSheetZoneMimeType) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      const quickSwapItem = resolveDraggedQuickSwapItem(event.dataTransfer);
      const internalReferenceGridPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const hasInternalReferenceGridHints = hasInternalReferenceDragTypeHints(event.dataTransfer);
      const hasExternalImageReference = hasDroppedImageReferenceTransfer(event.dataTransfer);
      const isInternalSheetDrag =
        Boolean(sourceCharacterSheetZoneKey) &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey);
      const isInternalReferenceDrag = Boolean(quickSwapItem);
      const isInternalReferenceGridDrag = Boolean(
        canResolveCharacterDropReference &&
        (internalReferenceGridPayload || hasInternalReferenceGridHints)
      );
      if (
        !isInternalSheetDrag &&
        !isInternalReferenceDrag &&
        !isInternalReferenceGridDrag &&
        !hasExternalImageReference
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect =
        isInternalSheetDrag || isInternalReferenceDrag ? "move" : "copy";
      setActiveCharacterSheetDropZone(characterSheetSlotKey);
    },
    [
      canResolveCharacterDropReference,
      characterSheetZoneMimeType,
      draggedCharacterSheetZoneKey,
      isDropResolutionBusy,
      pageBusy,
      resolveDraggedQuickSwapItem,
      setActiveCharacterSheetDropZone,
    ]
  );

  const clearCharacterSheetAssignment = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => {
      if (!selectedCharacterId) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
      if (!assignedReference) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: null,
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [
      persistCharacterSheetPresetAssignments,
      resolvedCharacterSheetPresetAssignments,
      selectedCharacterId,
    ]
  );

  const handleCharacterSheetDrop = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setActiveCharacterSheetDropZone(null);
      if (pageBusy || isDropResolutionBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(characterSheetZoneMimeType) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      if (
        sourceCharacterSheetZoneKey &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey)
      ) {
        const sourceReference =
          resolvedCharacterSheetPresetAssignments[sourceCharacterSheetZoneKey];
        if (!sourceReference) return;
        if (sourceCharacterSheetZoneKey === characterSheetSlotKey) return;
        const targetReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
        const nextAssignments = {
          ...resolvedCharacterSheetPresetAssignments,
          [sourceCharacterSheetZoneKey]: targetReference ?? null,
          [characterSheetSlotKey]: sourceReference,
        };
        persistCharacterSheetPresetAssignments(nextAssignments);
        return;
      }

      const quickSwapItem = resolveDraggedQuickSwapItem(event.dataTransfer);
      if (quickSwapItem) {
        assignReferenceToCharacterSheetSlot(characterSheetSlotKey, quickSwapItem.id);
        return;
      }

      setActiveCharacterSheetDropZone(characterSheetSlotKey);
      void handleCharacterSheetReferenceDrop(characterSheetSlotKey, event.dataTransfer).finally(
        () => {
          setActiveCharacterSheetDropZone((current) =>
            current === characterSheetSlotKey ? null : current
          );
        }
      );
    },
    [
      assignReferenceToCharacterSheetSlot,
      characterSheetZoneMimeType,
      draggedCharacterSheetZoneKey,
      handleCharacterSheetReferenceDrop,
      isDropResolutionBusy,
      pageBusy,
      persistCharacterSheetPresetAssignments,
      resolveDraggedQuickSwapItem,
      resolvedCharacterSheetPresetAssignments,
      setActiveCharacterSheetDropZone,
    ]
  );

  const handleCharacterSheetCardClick = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => () => {
      if (pageBusy || isDropResolutionBusy) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[dropZoneKey];
      if (assignedReference) return;
      openCharacterSheetPicker(dropZoneKey);
    },
    [
      isDropResolutionBusy,
      openCharacterSheetPicker,
      pageBusy,
      resolvedCharacterSheetPresetAssignments,
    ]
  );

  return {
    handleCharacterSheetFileSelection,
    handleCharacterSheetDragOver,
    clearCharacterSheetAssignment,
    handleCharacterSheetDrop,
    handleCharacterSheetCardClick,
  };
};
