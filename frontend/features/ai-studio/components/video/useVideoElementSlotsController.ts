/**
 * Owns Video panel linked-asset slot state for Kling and Seedance workflows.
 * Keeps slot normalization, picker state, saved-entity refresh, and Seedance limits out of the panel shell.
 */
import React from "react";
import {
  collectSeedanceElementProviderReferences,
  createSeedanceAudioReferenceSlot,
  createSeedanceImageReferenceSlot,
  createSeedanceVideoReferenceSlot,
  isElementSlotVisibleForVideoModel,
  resolveSeedanceReferenceLimitError,
  type AiStudioKlingElement,
  type AiStudioKlingSavedEntitySourceKind,
} from "../../logic/klingElements";
import { loadSavedKlingEntityBySource } from "../../logic/klingEntityAdapters";
import { useVideoSavedKlingElementRefresh } from "../useVideoSavedKlingElementRefresh";

const VIDEO_KLING_ELEMENT_SLOT_COUNT = 3;
const VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT = 9;

const resolveKlingElementPanelSlotIndex = (
  element: AiStudioKlingElement,
  fallbackIndex: number
): number | null =>
  typeof element.slotIndex === "number" &&
  Number.isInteger(element.slotIndex) &&
  element.slotIndex >= 0
    ? element.slotIndex
    : fallbackIndex >= 0
      ? fallbackIndex
      : null;

const sortKlingElementsBySlotIndex = (elements: AiStudioKlingElement[]): AiStudioKlingElement[] =>
  [...elements].sort((a, b) => {
    const left = a.slotIndex ?? 0;
    const right = b.slotIndex ?? 0;
    return left - right;
  });

type SeedanceElementMediaSlotValue = {
  kind: "image" | "video" | "audio";
  url: string;
  name?: string | null;
} | null;

type UseVideoElementSlotsControllerArgs = {
  isSeedance2FamilyModelSelected: boolean;
  klingElements: AiStudioKlingElement[];
  onKlingElementsChange?: (value: AiStudioKlingElement[]) => void;
};

/**
 * Returns normalized slot data and mutation handlers for the Video linked-asset controls.
 */
export function useVideoElementSlotsController({
  isSeedance2FamilyModelSelected,
  klingElements,
  onKlingElementsChange,
}: UseVideoElementSlotsControllerArgs) {
  const [elementPickerSlotIndex, setElementPickerSlotIndex] = React.useState<number | null>(null);
  const [isElementPickerOpen, setIsElementPickerOpen] = React.useState(false);
  const [elementPickerError, setElementPickerError] = React.useState<string | null>(null);
  const [seedanceSlotLimitWarning, setSeedanceSlotLimitWarning] = React.useState<string | null>(
    null
  );
  const klingElementSlotCount = isSeedance2FamilyModelSelected
    ? VIDEO_SEEDANCE_ELEMENT_SLOT_COUNT
    : VIDEO_KLING_ELEMENT_SLOT_COUNT;

  const commitSelectedKlingElements = React.useCallback(
    (elements: Array<AiStudioKlingElement | null>) => {
      const visibleSlotIndexes = new Set(
        Array.from({ length: klingElementSlotCount }, (_, index) => index)
      );
      const committedVisibleElements = elements
        .map((item, index) => {
          if (!item) return null;
          const slotIndex = resolveKlingElementPanelSlotIndex(item, index);
          if (slotIndex == null || !visibleSlotIndexes.has(slotIndex)) return null;
          return item.slotIndex === slotIndex ? item : { ...item, slotIndex };
        })
        .filter((item): item is AiStudioKlingElement => Boolean(item));
      const preservedHiddenElements = klingElements.filter((element, index) => {
        const slotIndex = resolveKlingElementPanelSlotIndex(element, index);
        return slotIndex != null && !visibleSlotIndexes.has(slotIndex);
      });
      onKlingElementsChange?.(
        sortKlingElementsBySlotIndex([...preservedHiddenElements, ...committedVisibleElements])
      );
    },
    [klingElementSlotCount, klingElements, onKlingElementsChange]
  );

  const selectedKlingElements = React.useMemo(() => {
    const slots = Array.from(
      { length: klingElementSlotCount },
      () => null as AiStudioKlingElement | null
    );
    const legacyElements: AiStudioKlingElement[] = [];

    klingElements.forEach((element) => {
      const slotIndex = resolveKlingElementPanelSlotIndex(element, -1);

      if (slotIndex != null && slotIndex >= klingElementSlotCount) {
        return;
      }

      if (slotIndex == null || slotIndex < 0) {
        legacyElements.push(element);
        return;
      }

      if (!slots[slotIndex]) {
        slots[slotIndex] = element.slotIndex === slotIndex ? element : { ...element, slotIndex };
        return;
      }

      legacyElements.push(element);
    });

    legacyElements.forEach((element) => {
      const emptySlotIndex = slots.findIndex((slot) => slot == null);
      if (emptySlotIndex < 0) return;
      slots[emptySlotIndex] = { ...element, slotIndex: emptySlotIndex };
    });

    return slots;
  }, [klingElementSlotCount, klingElements]);

  const resolveSeedanceElementSlotLimitError = React.useCallback(
    (elements: Array<AiStudioKlingElement | null>) => {
      if (!isSeedance2FamilyModelSelected) return null;
      const references = collectSeedanceElementProviderReferences(
        elements.filter((element): element is AiStudioKlingElement => Boolean(element))
      );
      return resolveSeedanceReferenceLimitError(references);
    },
    [isSeedance2FamilyModelSelected]
  );

  const modelVisibleKlingElements = React.useMemo(
    () =>
      selectedKlingElements.map((element) =>
        isElementSlotVisibleForVideoModel(element, {
          allowSeedanceImageReferences: isSeedance2FamilyModelSelected,
        })
          ? element
          : null
      ),
    [isSeedance2FamilyModelSelected, selectedKlingElements]
  );

  const handleSeedanceElementMediaSlotChange = React.useCallback(
    (slotIndex: number, value: SeedanceElementMediaSlotValue) => {
      const next = Array.from(
        { length: klingElementSlotCount },
        (_, index) => selectedKlingElements[index] ?? null
      );
      if (!value) {
        next[slotIndex] = null;
      } else if (value.kind === "video") {
        next[slotIndex] = createSeedanceVideoReferenceSlot({
          slotIndex,
          videoUrl: value.url,
          name: value.name,
        });
      } else if (value.kind === "audio") {
        next[slotIndex] = createSeedanceAudioReferenceSlot({
          slotIndex,
          audioUrl: value.url,
          name: value.name,
        });
      } else {
        next[slotIndex] = createSeedanceImageReferenceSlot({
          slotIndex,
          imageUrl: value.url,
          name: value.name,
        });
      }
      const limitError = resolveSeedanceElementSlotLimitError(next);
      if (limitError) {
        setSeedanceSlotLimitWarning(limitError);
        return;
      }
      setSeedanceSlotLimitWarning(null);
      commitSelectedKlingElements(next);
    },
    [
      commitSelectedKlingElements,
      klingElementSlotCount,
      resolveSeedanceElementSlotLimitError,
      selectedKlingElements,
    ]
  );

  const { rememberSavedKlingElementRefreshKey } = useVideoSavedKlingElementRefresh({
    selectedKlingElements,
    onKlingElementsChange,
    commitSelectedKlingElements,
  });

  const openElementPicker = React.useCallback((slotIndex: number) => {
    setElementPickerError(null);
    setElementPickerSlotIndex(slotIndex);
    setIsElementPickerOpen(true);
  }, []);

  const closeElementPicker = React.useCallback(() => {
    setIsElementPickerOpen(false);
    setElementPickerSlotIndex(null);
  }, []);

  const handleElementSelection = React.useCallback(
    async ({
      sourceKind,
      sourceId,
      sourceCharacterLookId = null,
    }: {
      sourceKind: AiStudioKlingSavedEntitySourceKind;
      sourceId: string;
      sourceCharacterLookId?: string | null;
    }) => {
      if (elementPickerSlotIndex == null) return;
      try {
        const selectedElement = await loadSavedKlingEntityBySource({
          sourceKind,
          sourceId,
          sourceCharacterLookId,
        });
        rememberSavedKlingElementRefreshKey(selectedElement, elementPickerSlotIndex);
        const next = Array.from(
          { length: klingElementSlotCount },
          (_, index) => selectedKlingElements[index] ?? null
        );
        next[elementPickerSlotIndex] = { ...selectedElement, slotIndex: elementPickerSlotIndex };
        const limitError = resolveSeedanceElementSlotLimitError(next);
        if (limitError) {
          setSeedanceSlotLimitWarning(limitError);
          return;
        }
        commitSelectedKlingElements(next);
        setElementPickerError(null);
        setSeedanceSlotLimitWarning(null);
      } catch {
        setElementPickerError("Unable to attach that saved element.");
      } finally {
        closeElementPicker();
      }
    },
    [
      closeElementPicker,
      commitSelectedKlingElements,
      elementPickerSlotIndex,
      klingElementSlotCount,
      rememberSavedKlingElementRefreshKey,
      resolveSeedanceElementSlotLimitError,
      selectedKlingElements,
    ]
  );

  const removeSelectedElement = React.useCallback(
    (slotIndex: number) => {
      const next = Array.from(
        { length: klingElementSlotCount },
        (_, index) => selectedKlingElements[index] ?? null
      );
      next[slotIndex] = null;
      commitSelectedKlingElements(next);
    },
    [commitSelectedKlingElements, klingElementSlotCount, selectedKlingElements]
  );

  return {
    closeElementPicker,
    elementPickerError,
    elementPickerSlotIndex,
    handleElementSelection,
    handleSeedanceElementMediaSlotChange,
    isElementPickerOpen,
    klingElementSlotCount,
    modelVisibleKlingElements,
    openElementPicker,
    removeSelectedElement,
    seedanceSlotLimitWarning,
    selectedKlingElements,
  };
}
