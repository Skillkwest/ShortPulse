/**
 * Kling list mutation helpers for AI Studio reference properties interactions.
 * Keeps list updates separate from drag/drop and media staging behavior.
 */
import { useCallback } from "react";
import { createEmptyAiStudioKlingElement, type AiStudioKlingElement } from "../logic/klingElements";
import type { KlingMultiPrompt } from "./referencePropertiesTypes";

type UseReferencePropertiesKlingActionsArgs = {
  enabled: boolean;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: AiStudioKlingElement[];
  onKlingElementsChange?: (value: AiStudioKlingElement[]) => void;
};

const makeKlingShotId = () => `kling-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Returns stable Kling shot and element list actions for the reference properties panel.
 */
export const useReferencePropertiesKlingActions = ({
  enabled,
  klingMultiPrompts,
  onKlingMultiPromptsChange,
  klingElements,
  onKlingElementsChange,
}: UseReferencePropertiesKlingActionsArgs) => {
  const updateKlingMultiPrompt = useCallback(
    (id: string, key: "prompt" | "duration", value: string | number) => {
      if (!enabled) return;
      const next = klingMultiPrompts.map((item) =>
        item.id === id ? { ...item, [key]: value } : item
      );
      onKlingMultiPromptsChange?.(next);
    },
    [enabled, klingMultiPrompts, onKlingMultiPromptsChange]
  );

  const addKlingShot = useCallback(() => {
    if (!enabled) return;
    onKlingMultiPromptsChange?.([
      ...klingMultiPrompts,
      { id: makeKlingShotId(), prompt: "", duration: 5 },
    ]);
  }, [enabled, klingMultiPrompts, onKlingMultiPromptsChange]);

  const removeKlingShot = useCallback(
    (id: string) => {
      if (!enabled) return;
      onKlingMultiPromptsChange?.(klingMultiPrompts.filter((item) => item.id !== id));
    },
    [enabled, klingMultiPrompts, onKlingMultiPromptsChange]
  );

  const updateKlingElement = useCallback(
    (id: string, key: "frontalImageUrl" | "referenceImageUrls" | "videoUrl", value: string) => {
      if (!enabled) return;
      const next = klingElements.map((item) => (item.id === id ? { ...item, [key]: value } : item));
      onKlingElementsChange?.(next);
    },
    [enabled, klingElements, onKlingElementsChange]
  );

  const addKlingElement = useCallback(() => {
    if (!enabled) return;
    if (klingElements.length >= 3) return;
    onKlingElementsChange?.([...klingElements, createEmptyAiStudioKlingElement()]);
  }, [enabled, klingElements, onKlingElementsChange]);

  const removeKlingElement = useCallback(
    (id: string) => {
      if (!enabled) return;
      onKlingElementsChange?.(klingElements.filter((item) => item.id !== id));
    },
    [enabled, klingElements, onKlingElementsChange]
  );

  return {
    updateKlingMultiPrompt,
    addKlingShot,
    removeKlingShot,
    updateKlingElement,
    addKlingElement,
    removeKlingElement,
  };
};
