/**
 * Adapts Video linked-asset slot state to the saved entity picker modal.
 */
import React from "react";
import { ElementPickerModal } from "../ElementPickerModal";
import {
  isPromptTokenEligibleKlingElement,
  type AiStudioKlingElement,
  type AiStudioKlingSavedEntitySourceKind,
} from "../../logic/klingElements";

type ElementPickerSelection = {
  sourceKind: AiStudioKlingSavedEntitySourceKind;
  sourceId: string;
  sourceCharacterLookId?: string | null;
};

type VideoElementPickerBridgeProps = {
  elementPickerSlotIndex: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateCharacter?: () => void;
  onCreateElement?: () => void;
  onSelect: (selection: ElementPickerSelection) => void;
  selectedKlingElements: Array<AiStudioKlingElement | null>;
};

/**
 * Renders the saved entity picker with the currently selected Video linked-asset slot state.
 */
export function VideoElementPickerBridge({
  elementPickerSlotIndex,
  isOpen,
  onClose,
  onCreateCharacter,
  onCreateElement,
  onSelect,
  selectedKlingElements,
}: VideoElementPickerBridgeProps) {
  const selectedEntities = selectedKlingElements
    .filter((element): element is AiStudioKlingElement =>
      isPromptTokenEligibleKlingElement(element)
    )
    .flatMap((element): ElementPickerSelection[] => {
      const sourceKind: AiStudioKlingSavedEntitySourceKind | null = element.sourceCharacterId
        ? "character"
        : element.sourceElementId
          ? "element"
          : null;
      const sourceId = element.sourceCharacterId ?? element.sourceElementId ?? "";
      if (!sourceKind || !sourceId) return [];
      return [
        {
          sourceKind,
          sourceId,
          sourceCharacterLookId:
            sourceKind === "character" ? (element.sourceCharacterLookId ?? null) : null,
        },
      ];
    });

  const selectedElement =
    elementPickerSlotIndex != null ? selectedKlingElements[elementPickerSlotIndex] : null;
  const selectedSourceKind = selectedElement?.sourceCharacterId
    ? "character"
    : selectedElement?.sourceElementId
      ? "element"
      : null;
  const selectedSourceId = isPromptTokenEligibleKlingElement(selectedElement)
    ? (selectedElement?.sourceCharacterId ?? selectedElement?.sourceElementId ?? null)
    : null;
  const selectedSourceCharacterLookId = selectedElement?.sourceCharacterId
    ? (selectedElement.sourceCharacterLookId ?? null)
    : null;

  return (
    <ElementPickerModal
      isOpen={isOpen}
      onClose={onClose}
      onCreateCharacter={onCreateCharacter}
      onCreateElement={onCreateElement}
      onSelect={onSelect}
      selectedEntities={selectedEntities}
      selectedSourceCharacterLookId={selectedSourceCharacterLookId}
      selectedSourceId={selectedSourceId}
      selectedSourceKind={selectedSourceKind}
    />
  );
}
