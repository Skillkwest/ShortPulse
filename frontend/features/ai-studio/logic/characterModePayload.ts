/**
 * Character Mode payload helpers for AI Studio Create submissions.
 * Resolves ordered Character Sheet references and hidden prompt composition.
 */
import type {
  CharacterSheetAssignments,
  CharacterSheetDropZoneKey,
  CharacterSlotFileMap,
} from "../../character-manager/types";

const CHARACTER_SHEET_ZONE_ORDER: CharacterSheetDropZoneKey[] = [
  "portrait",
  "close_up",
  "front_shot",
  "back_shot",
];

const normalizeText = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

/**
 * Resolves Character Sheet image URLs in canonical zone order.
 */
export const resolveCharacterSheetReferenceUrls = (
  assignments: CharacterSheetAssignments,
  slots: CharacterSlotFileMap
): string[] => {
  const orderedUrls: string[] = [];
  for (const zoneKey of CHARACTER_SHEET_ZONE_ORDER) {
    const slotKey = assignments[zoneKey];
    if (!slotKey) continue;
    const url = slots[slotKey]?.previewUrl;
    if (!url) continue;
    orderedUrls.push(url);
  }
  return Array.from(new Set(orderedUrls));
};

/**
 * Resolves Character Sheet storage paths in canonical zone order.
 */
export const resolveCharacterSheetReferenceStoragePaths = (
  assignments: CharacterSheetAssignments,
  slots: CharacterSlotFileMap
): string[] => {
  const orderedStoragePaths: string[] = [];
  for (const zoneKey of CHARACTER_SHEET_ZONE_ORDER) {
    const slotKey = assignments[zoneKey];
    if (!slotKey) continue;
    const storagePath = slots[slotKey]?.storagePath;
    if (!storagePath) continue;
    orderedStoragePaths.push(storagePath);
  }
  return Array.from(new Set(orderedStoragePaths));
};

/**
 * Builds the provider-facing prompt with hidden character context first.
 */
export const composeCharacterModePrompt = ({
  characterDescription,
  userPrompt,
}: {
  characterDescription: string | null | undefined;
  userPrompt: string | null | undefined;
}): string => {
  const description = normalizeText(characterDescription);
  const prompt = normalizeText(userPrompt);
  if (!description) return prompt;
  if (!prompt) return description;
  return `${description}\n\n${prompt}`;
};

/**
 * Merges Character Sheet references ahead of any additional references.
 */
export const mergeCharacterAndUserReferences = (
  characterReferenceUrls: string[],
  userReferenceUrls: string[],
  maxReferences = 10
): string[] => {
  const merged = [...characterReferenceUrls, ...userReferenceUrls].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0
  );
  return Array.from(new Set(merged)).slice(0, Math.max(0, maxReferences));
};
