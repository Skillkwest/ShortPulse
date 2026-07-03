/**
 * Owns the Expert Edit secondary-reference slot visibility rules.
 */
import React from "react";

import {
  DEFAULT_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
  MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT,
} from "./expertEditPanelViewContract";

type UseExpertEditSecondaryReferenceSlotsArgs = {
  extraImageUrls: readonly (string | null)[];
  onExtraImageChange: (index: number, url: string | null) => void;
};

export function resolveDefaultVisibleSecondarySlotIndexes(
  values: readonly (string | null)[]
): number[] {
  const indexes = new Set<number>();
  Array.from({ length: DEFAULT_EXPERT_EDIT_SECONDARY_SLOT_COUNT }, (_, index) => index).forEach(
    (index) => indexes.add(index)
  );
  values.forEach((value, index) => {
    if (index >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT) return;
    if ((value?.trim() ?? "").length > 0) {
      indexes.add(index);
    }
  });
  return Array.from(indexes).sort((left, right) => left - right);
}

export function useExpertEditSecondaryReferenceSlots({
  extraImageUrls,
  onExtraImageChange,
}: UseExpertEditSecondaryReferenceSlotsArgs) {
  const [visibleSecondarySlotIndexes, setVisibleSecondarySlotIndexes] = React.useState<number[]>(
    () => resolveDefaultVisibleSecondarySlotIndexes(extraImageUrls)
  );

  React.useEffect(() => {
    setVisibleSecondarySlotIndexes((previous) => {
      const nextIndexes = new Set(previous);
      extraImageUrls.forEach((value, index) => {
        if ((value?.trim() ?? "").length > 0) {
          nextIndexes.add(index);
        }
      });
      return Array.from(nextIndexes)
        .filter((index) => index >= 0 && index < MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT)
        .sort((left, right) => left - right);
    });
  }, [extraImageUrls]);

  const visibleSecondaryGridItemCount =
    visibleSecondarySlotIndexes.length +
    (visibleSecondarySlotIndexes.length < extraImageUrls.length ? 1 : 0);
  const isSecondaryReferenceTrayWrapped = visibleSecondaryGridItemCount > 5;

  const handleAddSecondaryReferenceSlot = React.useCallback(() => {
    setVisibleSecondarySlotIndexes((previous) => {
      if (previous.length >= MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT) return previous;
      const visibleSet = new Set(previous);
      const nextIndex = Array.from(
        { length: MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT },
        (_, index) => index
      ).find((index) => !visibleSet.has(index));
      if (nextIndex == null) return previous;
      return [...previous, nextIndex].sort((left, right) => left - right);
    });
  }, []);

  const handleRemoveSecondaryReferenceSlot = React.useCallback(
    (index: number) => {
      onExtraImageChange(index, null);
      if (index === 0) return;
      setVisibleSecondarySlotIndexes((previous) =>
        previous.filter((slotIndex) => slotIndex !== index)
      );
    },
    [onExtraImageChange]
  );

  return {
    visibleSecondarySlotIndexes,
    isSecondaryReferenceTrayWrapped,
    handleAddSecondaryReferenceSlot,
    handleRemoveSecondaryReferenceSlot,
  };
}
