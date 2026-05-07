import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from "react";
import type {
  CharacterQuickSwapItem,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
} from "../types";

const DRAG_GHOST_SCALE = 0.74;
const DRAG_GHOST_IMAGE_BLOB_SELECTOR =
  ".character-reference-upload-image-wrap, .character-character-sheet-media";

type UseCharacterManagerDragInteractionsParams = {
  pageBusy: boolean;
  quickSwapMutating: boolean;
  isDropResolutionBusy: boolean;
  resolvedCharacterSheetPresetAssignments: CharacterSheetPresetAssignments;
  setDraggedQuickSwapItemId: Dispatch<SetStateAction<string | null>>;
  setDraggedCharacterSheetZoneKey: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  setActiveCharacterSheetDropZone: Dispatch<SetStateAction<CharacterSheetDropZoneKey | null>>;
  quickSwapMimeType: string;
  referenceSlotMimeType: string;
  characterSheetZoneMimeType: string;
};

type UseCharacterManagerDragInteractionsResult = {
  handleReferenceDragStart: (
    item: CharacterQuickSwapItem
  ) => (event: DragEvent<HTMLElement>) => void;
  handleCharacterSheetDragStart: (
    characterSheetSlotKey: CharacterSheetDropZoneKey
  ) => (event: DragEvent<HTMLElement>) => void;
  handleReferenceDragEnd: (event: DragEvent<HTMLElement>) => void;
};

export const useCharacterManagerDragInteractions = ({
  pageBusy,
  quickSwapMutating,
  isDropResolutionBusy,
  resolvedCharacterSheetPresetAssignments,
  setDraggedQuickSwapItemId,
  setDraggedCharacterSheetZoneKey,
  setActiveCharacterSheetDropZone,
  quickSwapMimeType,
  referenceSlotMimeType,
  characterSheetZoneMimeType,
}: UseCharacterManagerDragInteractionsParams): UseCharacterManagerDragInteractionsResult => {
  const dragGhostMapRef = useRef(new Map<HTMLElement, HTMLElement>());

  const applyDragGhost = useCallback((event: DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    const transfer = event.dataTransfer;
    try {
      const blobNode = dragNode.querySelector<HTMLElement>(DRAG_GHOST_IMAGE_BLOB_SELECTOR);
      const ghostSourceNode = blobNode ?? dragNode;
      const sourceRect = ghostSourceNode.getBoundingClientRect();
      const fallbackRect = dragNode.getBoundingClientRect();
      const sourceWidth = sourceRect.width > 0 ? sourceRect.width : fallbackRect.width;
      const sourceHeight = sourceRect.height > 0 ? sourceRect.height : fallbackRect.height;
      const ghost = ghostSourceNode.cloneNode(true) as HTMLElement;
      const scaledWidth = Math.max(56, sourceWidth * DRAG_GHOST_SCALE);
      const scaledHeight = Math.max(72, sourceHeight * DRAG_GHOST_SCALE);
      ghost.classList.add("character-drag-ghost");
      if (blobNode) {
        ghost.classList.add("character-drag-ghost--image-only");
      }
      if (ghostSourceNode.classList.contains("character-character-sheet-media")) {
        ghost.classList.add("character-drag-ghost--character-sheet-media");
      }
      ghost.style.boxSizing = "border-box";
      ghost.style.width = `${scaledWidth}px`;
      ghost.style.height = `${scaledHeight}px`;
      ghost.style.transform = `scale(${DRAG_GHOST_SCALE}) rotate(-2deg)`;
      ghost.style.transformOrigin = "center";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.96";

      document.body.appendChild(ghost);
      dragGhostMapRef.current.set(dragNode, ghost);
      transfer.setDragImage(ghost, scaledWidth / 2, scaledHeight / 2);
    } catch {
      transfer.setDragImage(dragNode, dragNode.offsetWidth / 2, dragNode.offsetHeight / 2);
    }
    dragNode.classList.add("is-dragging");
  }, []);

  const handleReferenceDragStart = useCallback(
    (item: CharacterQuickSwapItem) => (event: DragEvent<HTMLElement>) => {
      if (pageBusy || quickSwapMutating || isDropResolutionBusy) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        quickSwapMimeType,
        JSON.stringify({
          id: item.id,
          characterMediaId: item.characterMediaId,
          storagePath: item.storagePath,
          previewUrl: item.previewUrl,
        })
      );
      event.dataTransfer.setData(referenceSlotMimeType, item.characterMediaId);
      event.dataTransfer.setData("text/plain", item.characterMediaId);
      setDraggedQuickSwapItemId(item.id);
      setDraggedCharacterSheetZoneKey(null);
      applyDragGhost(event);
    },
    [
      applyDragGhost,
      isDropResolutionBusy,
      pageBusy,
      quickSwapMimeType,
      quickSwapMutating,
      referenceSlotMimeType,
      setDraggedCharacterSheetZoneKey,
      setDraggedQuickSwapItemId,
    ]
  );

  const handleCharacterSheetDragStart = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: DragEvent<HTMLElement>) => {
      if (pageBusy || isDropResolutionBusy) {
        event.preventDefault();
        return;
      }
      const assignedReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
      if (!assignedReference) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(characterSheetZoneMimeType, characterSheetSlotKey);
      event.dataTransfer.setData(referenceSlotMimeType, assignedReference.characterMediaId);
      event.dataTransfer.setData("text/plain", assignedReference.characterMediaId);
      setDraggedCharacterSheetZoneKey(characterSheetSlotKey);
      setDraggedQuickSwapItemId(null);
      applyDragGhost(event);
    },
    [
      applyDragGhost,
      characterSheetZoneMimeType,
      isDropResolutionBusy,
      pageBusy,
      referenceSlotMimeType,
      resolvedCharacterSheetPresetAssignments,
      setDraggedCharacterSheetZoneKey,
      setDraggedQuickSwapItemId,
    ]
  );

  const handleReferenceDragEnd = useCallback(
    (event: DragEvent<HTMLElement>) => {
      const dragNode = event.currentTarget as HTMLElement;
      dragNode.classList.remove("is-dragging");
      const ghost = dragGhostMapRef.current.get(dragNode);
      if (ghost) {
        ghost.remove();
        dragGhostMapRef.current.delete(dragNode);
      }
      setDraggedQuickSwapItemId(null);
      setDraggedCharacterSheetZoneKey(null);
      setActiveCharacterSheetDropZone(null);
    },
    [setActiveCharacterSheetDropZone, setDraggedCharacterSheetZoneKey, setDraggedQuickSwapItemId]
  );

  useEffect(
    () => () => {
      for (const ghost of dragGhostMapRef.current.values()) {
        ghost.remove();
      }
      dragGhostMapRef.current.clear();
    },
    []
  );

  return {
    handleReferenceDragStart,
    handleCharacterSheetDragStart,
    handleReferenceDragEnd,
  };
};
