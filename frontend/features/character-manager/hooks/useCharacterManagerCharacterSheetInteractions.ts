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
  intakeBusy: boolean;
  slotMutationBusy: boolean;
  isAnyCharacterSheetSlotPending: boolean;
  isCharacterSheetSlotPending: (zoneKey: CharacterSheetDropZoneKey) => boolean;
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
  intakeBusy,
  slotMutationBusy,
  isAnyCharacterSheetSlotPending,
  isCharacterSheetSlotPending,
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

      if (!file || !targetDropZone || intakeBusy || isCharacterSheetSlotPending(targetDropZone)) {
        return;
      }
      void setCharacterSheetPresetFile(targetDropZone, file);
    },
    [
      intakeBusy,
      isCharacterSheetSlotPending,
      pendingCharacterSheetUploadZoneKey,
      setCharacterSheetPresetFile,
      setPendingCharacterSheetUploadZoneKey,
    ]
  );

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: DragEvent<HTMLElement>) => {
      if (intakeBusy) return;
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
      if (isInternalSheetDrag) {
        if (slotMutationBusy || isAnyCharacterSheetSlotPending) return;
      } else if (isCharacterSheetSlotPending(characterSheetSlotKey)) {
        return;
      }
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
      intakeBusy,
      isAnyCharacterSheetSlotPending,
      isCharacterSheetSlotPending,
      setActiveCharacterSheetDropZone,
      slotMutationBusy,
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
      if (intakeBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(characterSheetZoneMimeType) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      if (
        sourceCharacterSheetZoneKey &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey)
      ) {
        if (slotMutationBusy || isAnyCharacterSheetSlotPending) return;
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
      if (isCharacterSheetSlotPending(characterSheetSlotKey)) return;

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
      intakeBusy,
      isAnyCharacterSheetSlotPending,
      isCharacterSheetSlotPending,
      persistCharacterSheetPresetAssignments,
      resolvedCharacterSheetPresetAssignments,
      setActiveCharacterSheetDropZone,
      slotMutationBusy,
    ]
  );

  const handleCharacterSheetCardClick = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => () => {
      if (intakeBusy || isCharacterSheetSlotPending(dropZoneKey)) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[dropZoneKey];
      if (assignedReference) return;
      openCharacterSheetPicker(dropZoneKey);
    },
    [
      intakeBusy,
      isCharacterSheetSlotPending,
      openCharacterSheetPicker,
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
