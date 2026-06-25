import React from "react";
import {
  getAiStudioKlingElementReferenceUrls,
  type AiStudioKlingElement,
  type AiStudioKlingSavedEntitySourceKind,
} from "../logic/klingElements";
import { loadSavedKlingEntityBySource } from "../logic/klingEntityAdapters";

const buildSavedKlingElementRefreshKey = (
  element: AiStudioKlingElement,
  fallbackSlotIndex: number
): string | null => {
  const sourceKind: AiStudioKlingSavedEntitySourceKind | null = element.sourceCharacterId
    ? "character"
    : element.sourceElementId
      ? "element"
      : null;
  const sourceId = element.sourceCharacterId ?? element.sourceElementId ?? null;
  if (!sourceKind || !sourceId) return null;
  return [
    element.slotIndex ?? fallbackSlotIndex,
    sourceKind,
    sourceId,
    element.sourceCharacterLookId ?? "",
  ].join(":");
};

const hasKlingElementVisibleMedia = (element: AiStudioKlingElement): boolean =>
  Boolean(
    element.videoUrl.trim() ||
    element.audioUrl?.trim() ||
    getAiStudioKlingElementReferenceUrls(element).length ||
    element.profileImageUrl?.trim()
  );

type UseVideoSavedKlingElementRefreshArgs = {
  selectedKlingElements: Array<AiStudioKlingElement | null>;
  onKlingElementsChange?: (value: AiStudioKlingElement[]) => void;
  commitSelectedKlingElements: (elements: Array<AiStudioKlingElement | null>) => void;
};

export function useVideoSavedKlingElementRefresh({
  selectedKlingElements,
  onKlingElementsChange,
  commitSelectedKlingElements,
}: UseVideoSavedKlingElementRefreshArgs): {
  rememberSavedKlingElementRefreshKey: (
    element: AiStudioKlingElement,
    fallbackSlotIndex: number
  ) => void;
} {
  const normalizedSavedKlingElementKeysRef = React.useRef<Set<string>>(new Set());

  const rememberSavedKlingElementRefreshKey = React.useCallback(
    (element: AiStudioKlingElement, fallbackSlotIndex: number) => {
      const refreshKey = buildSavedKlingElementRefreshKey(element, fallbackSlotIndex);
      if (refreshKey) {
        normalizedSavedKlingElementKeysRef.current.add(refreshKey);
      }
    },
    []
  );

  React.useEffect(() => {
    if (!onKlingElementsChange) return;
    if (
      !selectedKlingElements.some(
        (element) => element?.sourceElementId || element?.sourceCharacterId
      )
    ) {
      return;
    }

    let cancelled = false;

    const normalizeAttachedElements = async () => {
      const normalizedRefreshKeys: string[] = [];
      const normalizedSlots = await Promise.all(
        selectedKlingElements.map(async (element, index) => {
          if (!element) return null;
          const slotIndex = element.slotIndex ?? index;

          if (!element.sourceElementId && !element.sourceCharacterId) {
            return hasKlingElementVisibleMedia(element) ? { ...element, slotIndex } : null;
          }

          const refreshKey = buildSavedKlingElementRefreshKey(element, index);
          if (
            refreshKey &&
            normalizedSavedKlingElementKeysRef.current.has(refreshKey) &&
            hasKlingElementVisibleMedia(element)
          ) {
            return { ...element, slotIndex };
          }

          try {
            const sourceKind: AiStudioKlingSavedEntitySourceKind = element.sourceCharacterId
              ? "character"
              : "element";
            const sourceId = element.sourceCharacterId ?? element.sourceElementId;
            if (!sourceId) return null;
            const refreshedElement = await loadSavedKlingEntityBySource({
              sourceKind,
              sourceId,
              sourceCharacterLookId: element.sourceCharacterLookId ?? null,
            });
            const hasUsableMedia = Boolean(
              refreshedElement.videoUrl.trim() ||
              getAiStudioKlingElementReferenceUrls(refreshedElement).length
            );
            if (!hasUsableMedia) {
              const hasSessionPresence = Boolean(
                element.videoUrl.trim() ||
                getAiStudioKlingElementReferenceUrls(element).length ||
                element.profileImageUrl?.trim() ||
                element.name?.trim() ||
                element.alias?.trim()
              );
              return hasSessionPresence ? { ...element, slotIndex } : null;
            }
            if (refreshKey) {
              normalizedRefreshKeys.push(refreshKey);
            }
            return { ...refreshedElement, slotIndex };
          } catch {
            return null;
          }
        })
      );

      if (cancelled) return;

      const currentSignature = JSON.stringify(
        selectedKlingElements.map((element, index) =>
          element
            ? {
                slotIndex: element.slotIndex ?? index,
                sourceKind: element.sourceKind ?? null,
                sourceElementId: element.sourceElementId ?? null,
                sourceCharacterId: element.sourceCharacterId ?? null,
                sourceCharacterLookId: element.sourceCharacterLookId ?? null,
                sourceCharacterLookLabel: element.sourceCharacterLookLabel ?? null,
                name: element.name ?? "",
                alias: element.alias ?? "",
                description: element.description ?? "",
                profileImageUrl: element.profileImageUrl ?? null,
                profileImageTransform: element.profileImageTransform ?? null,
                frontalImageUrl: element.frontalImageUrl,
                referenceImageUrls: element.referenceImageUrls,
                videoUrl: element.videoUrl,
              }
            : null
        )
      );
      const nextSignature = JSON.stringify(
        normalizedSlots.map((element) =>
          element
            ? {
                slotIndex: element.slotIndex,
                sourceKind: element.sourceKind ?? null,
                sourceElementId: element.sourceElementId ?? null,
                sourceCharacterId: element.sourceCharacterId ?? null,
                sourceCharacterLookId: element.sourceCharacterLookId ?? null,
                sourceCharacterLookLabel: element.sourceCharacterLookLabel ?? null,
                name: element.name ?? "",
                alias: element.alias ?? "",
                description: element.description ?? "",
                profileImageUrl: element.profileImageUrl ?? null,
                profileImageTransform: element.profileImageTransform ?? null,
                frontalImageUrl: element.frontalImageUrl,
                referenceImageUrls: element.referenceImageUrls,
                videoUrl: element.videoUrl,
              }
            : null
        )
      );

      if (currentSignature !== nextSignature) {
        commitSelectedKlingElements(normalizedSlots);
      }
      normalizedRefreshKeys.forEach((key) => {
        normalizedSavedKlingElementKeysRef.current.add(key);
      });
    };

    void normalizeAttachedElements();

    return () => {
      cancelled = true;
    };
  }, [commitSelectedKlingElements, onKlingElementsChange, selectedKlingElements]);

  return { rememberSavedKlingElementRefreshKey };
}
