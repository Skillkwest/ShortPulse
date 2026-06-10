/**
 * Element readiness helpers shared by the Elements panel and persistence core.
 * Keeps reusable Element status aligned before and after Supabase persistence.
 */
import type { ElementAssetType, ElementStatus } from "../types";
import { ELEMENT_IMAGE_REFERENCE_SLOT_LIMIT } from "./elementReferenceSlots";

/**
 * Returns trimmed, distinct image references in user-authored order.
 */
export const normalizeElementImageReferenceUrls = (
  referenceUrls: readonly string[],
  maxSlots = ELEMENT_IMAGE_REFERENCE_SLOT_LIMIT
): string[] => {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const referenceUrl of referenceUrls) {
    const trimmed = referenceUrl.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= maxSlots) break;
  }
  return normalized;
};

/**
 * Returns whether the draft has enough media references for its asset type.
 */
export const hasRequiredElementMediaReferences = ({
  assetType,
  imageReferenceUrls,
  videoReferenceUrl,
}: {
  assetType: ElementAssetType;
  imageReferenceUrls: readonly string[];
  videoReferenceUrl: string | null;
}): boolean => {
  if (assetType === "video") {
    return Boolean(videoReferenceUrl?.trim());
  }
  return normalizeElementImageReferenceUrls(imageReferenceUrls).length >= 2;
};

/**
 * Derives the local/persisted Element readiness label from the same media rules.
 */
export const deriveElementStatusFromDraft = ({
  name,
  assetType,
  imageReferenceUrls,
  videoReferenceUrl,
}: {
  name: string;
  assetType: ElementAssetType;
  imageReferenceUrls: readonly string[];
  videoReferenceUrl: string | null;
}): ElementStatus => {
  if (name.trim().length < 2) {
    return "draft";
  }
  return hasRequiredElementMediaReferences({
    assetType,
    imageReferenceUrls,
    videoReferenceUrl,
  })
    ? "ready"
    : "draft";
};
