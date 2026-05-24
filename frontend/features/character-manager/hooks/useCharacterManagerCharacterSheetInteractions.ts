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
import type { CharacterSheetDropZoneKey, CharacterSheetPresetAssignments } from "../types";

type UseCharacterManagerCharacterSheetInteractionsParams = {
  pageBusy: boolean;
  isDropResolutionBusy: boolean;
  pendingCharacterSheetUploadZoneKey: CharacterSheetDropZoneKey | null;
  setPendingCharacterSheetUploadZoneKey: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  setCharacterSheetPresetFile: (zoneKey: CharacterSheetDropZoneKey, file: File) => Promise<unknown>;
  resolvedCharacterSheetPresetAssignments: CharacterSheetPresetAssignments;
  saveCharacterSheetPresetAssignments: (
    assignments: CharacterSheetPresetAssignments
  ) => Promise<unknown>;
  draggedCharacterSheetZoneKey: CharacterSheetDropZoneKey | null;
  canResolveCharacterDropReference: boolean;
  handleCharacterSheetReferenceDrop: (
    zoneKey: CharacterSheetDropZoneKey,
    transfer: DataTransfer
  ) => Promise<void>;
  setActiveCharacterSheetDropZone: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  openCharacterSheetPicker: (dropZoneKey: CharacterSheetDropZoneKey) => void;
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
  pendingCharacterSheetUploadZoneKey,
  setPendingCharacterSheetUploadZoneKey,
  setCharacterSheetPresetFile,
  resolvedCharacterSheetPresetAssignments,
  saveCharacterSheetPresetAssignments,
  draggedCharacterSheetZoneKey,
  canResolveCharacterDropReference,
  handleCharacterSheetReferenceDrop,
  setActiveCharacterSheetDropZone,
  openCharacterSheetPicker,
  characterSheetZoneMimeType,
}: UseCharacterManagerCharacterSheetInteractionsParams): UseCharacterManagerCharacterSheetInteractionsResult => {
  const persistCharacterSheetPresetAssignments = useCallback(
    (nextAssignments: CharacterSheetPresetAssignments) => {
      void saveCharacterSheetPresetAssignments(nextAssignments);
    },
    [saveCharacterSheetPresetAssignments]
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

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: DragEvent<HTMLElement>) => {
      if (pageBusy || isDropResolutionBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(characterSheetZoneMimeType) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      const internalReferenceGridPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const hasInternalReferenceGridHints = hasInternalReferenceDragTypeHints(event.dataTransfer);
      const hasExternalImageReference = hasDroppedImageReferenceTransfer(event.dataTransfer);
      const isInternalSheetDrag =
        Boolean(sourceCharacterSheetZoneKey) &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey);
      const isInternalReferenceGridDrag = Boolean(
        canResolveCharacterDropReference &&
        (internalReferenceGridPayload || hasInternalReferenceGridHints)
      );
      if (!isInternalSheetDrag && !isInternalReferenceGridDrag && !hasExternalImageReference) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = isInternalSheetDrag ? "move" : "copy";
      setActiveCharacterSheetDropZone(characterSheetSlotKey);
    },
    [
      canResolveCharacterDropReference,
      characterSheetZoneMimeType,
      draggedCharacterSheetZoneKey,
      isDropResolutionBusy,
      pageBusy,
      setActiveCharacterSheetDropZone,
    ]
  );

  const clearCharacterSheetAssignment = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => {
      const assignedReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
      if (!assignedReference) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: null,
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [persistCharacterSheetPresetAssignments, resolvedCharacterSheetPresetAssignments]
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
      characterSheetZoneMimeType,
      draggedCharacterSheetZoneKey,
      handleCharacterSheetReferenceDrop,
      isDropResolutionBusy,
      pageBusy,
      persistCharacterSheetPresetAssignments,
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
