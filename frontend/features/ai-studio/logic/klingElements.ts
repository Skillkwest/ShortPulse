/**
 * Shared Kling element selection contract for AI Studio video workflows.
 * Keeps saved Elements-library metadata attached to the submission-facing media fields.
 */
import { randomId } from "./ids";
import type { CharacterProfileImageTransform } from "../../character-manager/types";
import { deriveElementAliasFromName } from "../../elements-manager/logic/elementAlias";
import type { ElementProfileImageTransform } from "../../elements-manager/types";

export type AiStudioKlingEntitySourceKind =
  | "element"
  | "character"
  | "reference-image"
  | "reference-video"
  | "reference-audio";
export type AiStudioKlingSavedEntitySourceKind = Exclude<
  AiStudioKlingEntitySourceKind,
  "reference-image" | "reference-video" | "reference-audio"
>;
export type AiStudioKlingProfileImageTransform =
  | ElementProfileImageTransform
  | CharacterProfileImageTransform;

export type AiStudioKlingElement = {
  id: string;
  slotIndex?: number;
  sourceKind?: AiStudioKlingEntitySourceKind | null;
  sourceElementId?: string | null;
  sourceCharacterId?: string | null;
  sourceCharacterLookId?: string | null;
  sourceCharacterLookLabel?: string | null;
  name?: string;
  // Legacy compatibility token retained for older prompts and restored sessions.
  alias?: string;
  description?: string;
  profileImageUrl?: string | null;
  profileImageTransform?: AiStudioKlingProfileImageTransform | null;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
  audioUrl?: string;
};

export type AiStudioKlingElementMediaKind = "none" | "image" | "video" | "audio" | "mixed";

export type AiStudioKlingElementProviderEligibility = {
  isSubmittable: boolean;
  mediaKind: AiStudioKlingElementMediaKind;
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
  reason: string | null;
};

export const KIE_KLING_ELEMENT_SLOT_LIMIT = 3;
export const KIE_KLING_MIN_IMAGE_ELEMENT_URLS = 2;
export const KIE_KLING_MAX_IMAGE_ELEMENT_URLS = 4;
export const SEEDANCE_REFERENCE_IMAGE_LIMIT = 9;
export const SEEDANCE_REFERENCE_VIDEO_LIMIT = 3;
export const SEEDANCE_REFERENCE_AUDIO_LIMIT = 3;
export const SEEDANCE_REFERENCE_TOTAL_LIMIT = 12;

export const createEmptyAiStudioKlingElement = (): AiStudioKlingElement => ({
  id: randomId(),
  slotIndex: undefined,
  sourceKind: null,
  sourceElementId: null,
  sourceCharacterId: null,
  sourceCharacterLookId: null,
  sourceCharacterLookLabel: null,
  name: "",
  alias: "",
  description: "",
  profileImageUrl: null,
  profileImageTransform: null,
  frontalImageUrl: "",
  referenceImageUrls: "",
  videoUrl: "",
  audioUrl: "",
});

export const createSeedanceImageReferenceSlot = ({
  slotIndex,
  imageUrl,
  name,
}: {
  slotIndex: number;
  imageUrl: string;
  name?: string | null;
}): AiStudioKlingElement => ({
  ...createEmptyAiStudioKlingElement(),
  slotIndex,
  sourceKind: "reference-image",
  name: name?.trim() || "Image reference",
  profileImageUrl: imageUrl,
  frontalImageUrl: imageUrl,
});

export const createSeedanceVideoReferenceSlot = ({
  slotIndex,
  videoUrl,
  name,
}: {
  slotIndex: number;
  videoUrl: string;
  name?: string | null;
}): AiStudioKlingElement => ({
  ...createEmptyAiStudioKlingElement(),
  slotIndex,
  sourceKind: "reference-video",
  name: name?.trim() || "Video reference",
  videoUrl,
});

export const createSeedanceAudioReferenceSlot = ({
  slotIndex,
  audioUrl,
  name,
}: {
  slotIndex: number;
  audioUrl: string;
  name?: string | null;
}): AiStudioKlingElement => ({
  ...createEmptyAiStudioKlingElement(),
  slotIndex,
  sourceKind: "reference-audio",
  name: name?.trim() || "Audio reference",
  audioUrl,
});

export const isSeedanceImageReferenceSlot = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined
): boolean => element?.sourceKind === "reference-image";

export const isSeedanceVideoReferenceSlot = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined
): boolean => element?.sourceKind === "reference-video";

export const isSeedanceAudioReferenceSlot = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined
): boolean => element?.sourceKind === "reference-audio";

export const isSeedanceDirectReferenceSlot = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined
): boolean =>
  isSeedanceImageReferenceSlot(element) ||
  isSeedanceVideoReferenceSlot(element) ||
  isSeedanceAudioReferenceSlot(element);

export const isPromptTokenEligibleKlingElement = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined
): boolean => Boolean(element && !isSeedanceDirectReferenceSlot(element));

export const isElementSlotVisibleForVideoModel = (
  element: Pick<AiStudioKlingElement, "sourceKind"> | null | undefined,
  options: { allowSeedanceImageReferences: boolean }
): boolean =>
  Boolean(
    element && (options.allowSeedanceImageReferences || !isSeedanceDirectReferenceSlot(element))
  );

export const getAiStudioKlingElementReferenceUrls = (
  element: Pick<AiStudioKlingElement, "frontalImageUrl" | "referenceImageUrls">
): string[] => {
  const frontal = element.frontalImageUrl.trim();
  const references = element.referenceImageUrls
    .split(/[,\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  return [frontal, ...references].filter(Boolean);
};

const resolveKlingElementDisplayName = (
  element: Pick<AiStudioKlingElement, "name" | "alias" | "slotIndex">,
  fallbackLabel?: string | null
): string => {
  const label = fallbackLabel?.trim();
  if (label) return label;
  const name = element.name?.trim();
  if (name) return name;
  const alias = element.alias?.trim();
  if (alias) return alias;
  return `slot ${(element.slotIndex ?? 0) + 1}`;
};

const dedupeTrimmedUrls = (urls: string[]): string[] =>
  Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

const countSeedanceProviderReferences = ({
  imageUrls,
  videoUrls,
  audioUrls,
}: {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
}): { imageCount: number; videoCount: number; audioCount: number; totalCount: number } => {
  const imageCount = dedupeTrimmedUrls(imageUrls).length;
  const videoCount = dedupeTrimmedUrls(videoUrls).length;
  const audioCount = dedupeTrimmedUrls(audioUrls).length;
  return {
    imageCount,
    videoCount,
    audioCount,
    totalCount: imageCount + videoCount + audioCount,
  };
};

export const resolveAiStudioKlingElementMediaKind = (
  element: Pick<
    AiStudioKlingElement,
    "frontalImageUrl" | "referenceImageUrls" | "videoUrl" | "audioUrl"
  >
): AiStudioKlingElementMediaKind => {
  const hasImages = getAiStudioKlingElementReferenceUrls(element).length > 0;
  const hasVideo = element.videoUrl.trim().length > 0;
  const hasAudio = (element.audioUrl ?? "").trim().length > 0;
  const mediaKindCount = [hasImages, hasVideo, hasAudio].filter(Boolean).length;
  if (mediaKindCount > 1) return "mixed";
  if (hasVideo) return "video";
  if (hasAudio) return "audio";
  if (hasImages) return "image";
  return "none";
};

/**
 * Resolves whether a linked slot can be sent to Kie Kling's `kling_elements` contract.
 */
export const resolveKieKlingElementProviderEligibility = (
  element: AiStudioKlingElement,
  options: { displayName?: string | null } = {}
): AiStudioKlingElementProviderEligibility => {
  const imageUrls = dedupeTrimmedUrls(getAiStudioKlingElementReferenceUrls(element));
  const videoUrls = dedupeTrimmedUrls([element.videoUrl]);
  const audioUrls = dedupeTrimmedUrls([element.audioUrl ?? ""]);
  const hasImages = imageUrls.length > 0;
  const hasVideo = videoUrls.length > 0;
  const hasAudio = audioUrls.length > 0;
  const displayName = resolveKlingElementDisplayName(element, options.displayName);

  if (isSeedanceDirectReferenceSlot(element)) {
    return {
      isSubmittable: false,
      mediaKind: resolveAiStudioKlingElementMediaKind(element),
      imageUrls,
      videoUrls,
      audioUrls,
      reason: null,
    };
  }

  if (hasAudio) {
    return {
      isSubmittable: false,
      mediaKind: resolveAiStudioKlingElementMediaKind(element),
      imageUrls,
      videoUrls,
      audioUrls,
      reason: `Kling element ${displayName} does not support audio references.`,
    };
  }

  if (hasImages && hasVideo) {
    return {
      isSubmittable: false,
      mediaKind: "mixed",
      imageUrls,
      videoUrls,
      audioUrls: [],
      reason: `Kling element ${displayName} must use either one video reference or 2-4 image references, not both.`,
    };
  }

  if (hasVideo) {
    return {
      isSubmittable: true,
      mediaKind: "video",
      imageUrls: [],
      videoUrls,
      audioUrls: [],
      reason: null,
    };
  }

  if (hasImages) {
    if (imageUrls.length < KIE_KLING_MIN_IMAGE_ELEMENT_URLS) {
      return {
        isSubmittable: false,
        mediaKind: "image",
        imageUrls,
        videoUrls: [],
        audioUrls: [],
        reason: `Kling element ${displayName} needs at least 2 image references before generating.`,
      };
    }
    return {
      isSubmittable: true,
      mediaKind: "image",
      imageUrls: imageUrls.slice(0, KIE_KLING_MAX_IMAGE_ELEMENT_URLS),
      videoUrls: [],
      audioUrls: [],
      reason: null,
    };
  }

  return {
    isSubmittable: false,
    mediaKind: "none",
    imageUrls: [],
    videoUrls: [],
    audioUrls: [],
    reason: null,
  };
};

export const resolveSeedanceElementProviderEligibility = (
  element: AiStudioKlingElement
): AiStudioKlingElementProviderEligibility => {
  const imageUrls = dedupeTrimmedUrls(getAiStudioKlingElementReferenceUrls(element));
  const videoUrls = dedupeTrimmedUrls([element.videoUrl]);
  const audioUrls = dedupeTrimmedUrls([element.audioUrl ?? ""]);
  const mediaKind = resolveAiStudioKlingElementMediaKind(element);
  return {
    isSubmittable: Boolean(imageUrls.length || videoUrls.length || audioUrls.length),
    mediaKind,
    imageUrls,
    videoUrls,
    audioUrls,
    reason: null,
  };
};

export const collectSeedanceElementProviderReferences = (elements: AiStudioKlingElement[]) =>
  elements.reduce<{ imageUrls: string[]; videoUrls: string[]; audioUrls: string[] }>(
    (accumulator, element) => {
      const eligibility = resolveSeedanceElementProviderEligibility(element);
      accumulator.imageUrls.push(...eligibility.imageUrls);
      accumulator.videoUrls.push(...eligibility.videoUrls);
      accumulator.audioUrls.push(...eligibility.audioUrls);
      return accumulator;
    },
    { imageUrls: [], videoUrls: [], audioUrls: [] }
  );

export const resolveSeedanceReferenceLimitError = ({
  imageUrls,
  videoUrls,
  audioUrls,
}: {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
}): string | null => {
  const { imageCount, videoCount, audioCount, totalCount } = countSeedanceProviderReferences({
    imageUrls,
    videoUrls,
    audioUrls,
  });
  if (imageCount > SEEDANCE_REFERENCE_IMAGE_LIMIT) {
    return `Seedance 2 supports up to ${SEEDANCE_REFERENCE_IMAGE_LIMIT} image references.`;
  }
  if (videoCount > SEEDANCE_REFERENCE_VIDEO_LIMIT) {
    return `Seedance 2 supports up to ${SEEDANCE_REFERENCE_VIDEO_LIMIT} video references.`;
  }
  if (audioCount > SEEDANCE_REFERENCE_AUDIO_LIMIT) {
    return `Seedance 2 supports up to ${SEEDANCE_REFERENCE_AUDIO_LIMIT} audio references.`;
  }
  if (totalCount > SEEDANCE_REFERENCE_TOTAL_LIMIT) {
    return `Seedance 2 supports up to ${SEEDANCE_REFERENCE_TOTAL_LIMIT} total references.`;
  }
  return null;
};

export const resolveSeedanceReferenceRequirementError = ({
  imageUrls,
  videoUrls,
  audioUrls,
}: {
  imageUrls: string[];
  videoUrls: string[];
  audioUrls: string[];
}): string | null => {
  const { imageCount, videoCount, audioCount } = countSeedanceProviderReferences({
    imageUrls,
    videoUrls,
    audioUrls,
  });
  if (audioCount > 0 && imageCount + videoCount === 0) {
    return "Seedance 2 audio references require at least one image or video reference.";
  }
  return null;
};

const resolveElementSlotIndex = (element: AiStudioKlingElement, fallbackIndex: number): number =>
  typeof element.slotIndex === "number" &&
  Number.isInteger(element.slotIndex) &&
  element.slotIndex >= 0
    ? element.slotIndex
    : fallbackIndex;

export const getKieKlingSubmittableSlotElements = (
  elements: AiStudioKlingElement[]
): AiStudioKlingElement[] =>
  elements
    .map((element, index) => ({
      element,
      slotIndex: resolveElementSlotIndex(element, index),
    }))
    .filter(({ element, slotIndex }) =>
      Boolean(
        slotIndex < KIE_KLING_ELEMENT_SLOT_LIMIT && isPromptTokenEligibleKlingElement(element)
      )
    )
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map(({ element, slotIndex }) =>
      element.slotIndex === slotIndex ? element : { ...element, slotIndex }
    );

export const resolveKieKlingElementsValidationMessage = (
  elements: AiStudioKlingElement[]
): string | null => {
  const submittableSlotElements = getKieKlingSubmittableSlotElements(elements);
  for (const element of submittableSlotElements) {
    const eligibility = resolveKieKlingElementProviderEligibility(element);
    if (eligibility.reason) return eligibility.reason;
  }
  return null;
};

export const normalizeAiStudioKlingCharacterToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 64);

const deriveAiStudioKlingElementBaseToken = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind">,
  index: number
): string => {
  if (element.sourceKind === "element") {
    const derivedNameToken = deriveElementAliasFromName(element.name ?? "");
    if (derivedNameToken) return derivedNameToken;
    const legacyAlias = element.alias?.trim();
    if (legacyAlias) return legacyAlias;
    return `Element${String(index + 1).padStart(2, "0")}`;
  }

  const alias = element.alias?.trim();
  if (alias) return alias;
  if (element.sourceKind === "character") {
    const derived = normalizeAiStudioKlingCharacterToken(element.name ?? "");
    if (derived) return derived;
  }
  return `Element${String(index + 1).padStart(2, "0")}`;
};

export const resolveAiStudioKlingElementTokens = (
  elements: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind"> | null | undefined>
): string[] => {
  const baseTokens = elements.map((element, index) =>
    element
      ? deriveAiStudioKlingElementBaseToken(element, index)
      : `Element${String(index + 1).padStart(2, "0")}`
  );
  const characterTokenSet = new Set(
    baseTokens
      .map((token, index) =>
        elements[index]?.sourceKind === "character" ? token.trim().toLowerCase() : null
      )
      .filter((token): token is string => Boolean(token))
  );
  const usedTokens = new Set<string>();

  return elements.map((element, index) => {
    if (!element) {
      return `Element${String(index + 1).padStart(2, "0")}`;
    }
    const baseToken = baseTokens[index] ?? `Element${String(index + 1).padStart(2, "0")}`;
    const normalizedBaseToken = baseToken.trim() || `Element${String(index + 1).padStart(2, "0")}`;
    const preferredToken =
      element.sourceKind === "element" && characterTokenSet.has(normalizedBaseToken.toLowerCase())
        ? `${normalizedBaseToken}_element`
        : normalizedBaseToken;

    let resolvedToken = preferredToken;
    let suffix = 2;
    while (usedTokens.has(resolvedToken.toLowerCase())) {
      resolvedToken = `${preferredToken}${suffix}`;
      suffix += 1;
    }
    usedTokens.add(resolvedToken.toLowerCase());
    return resolvedToken;
  });
};

export const resolveAiStudioKlingElementToken = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind">,
  index: number,
  allElements?: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind"> | null | undefined
  >
): string => {
  if (!allElements) {
    return deriveAiStudioKlingElementBaseToken(element, index);
  }

  return (
    resolveAiStudioKlingElementTokens(allElements)[index] ??
    deriveAiStudioKlingElementBaseToken(element, index)
  );
};

const buildCanonicalKieKlingElementToken = (slotIndex: number): string => `element${slotIndex + 1}`;

export const resolveKieKlingElementTokens = (
  elements: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string[] =>
  elements.map((element, index) => buildCanonicalKieKlingElementToken(element?.slotIndex ?? index));

export const resolveKieKlingElementToken = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">,
  index: number,
  allElements?: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string => {
  void allElements;
  return buildCanonicalKieKlingElementToken(element.slotIndex ?? index);
};

export const resolveLegacyKieKlingElementTokens = (
  elements: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string[] =>
  resolveAiStudioKlingElementTokens(elements).map((token, index) => {
    const normalized = token
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
    const fallback = `element_${String((elements[index]?.slotIndex ?? index) + 1).padStart(2, "0")}`;
    const base = normalized || fallback;
    return base.startsWith("element_") ? base : `element_${base}`;
  });

export const resolveLegacyKieKlingElementToken = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">,
  index: number,
  allElements?: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string => {
  if (!allElements) {
    return (
      resolveLegacyKieKlingElementTokens([element])[0] ??
      `element_${String(index + 1).padStart(2, "0")}`
    );
  }

  return (
    resolveLegacyKieKlingElementTokens(allElements)[index] ??
    `element_${String((element.slotIndex ?? index) + 1).padStart(2, "0")}`
  );
};

export const resolveAiStudioKlingElementLegacyTokens = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">,
  index: number,
  allElements?: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string[] => {
  const candidates = [
    resolveAiStudioKlingElementToken(element, index, allElements).trim(),
    resolveLegacyKieKlingElementToken(element, index, allElements).trim(),
    element.alias?.trim() ?? "",
  ].filter(Boolean);

  return Array.from(new Set(candidates));
};

export const resolveAiStudioKlingElementDisplayLabel = (
  element: Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">,
  index: number,
  allElements?: Array<
    Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex"> | null | undefined
  >
): string => {
  const name = element.name?.trim();
  if (name) return name;
  return (
    resolveAiStudioKlingElementToken(element, index, allElements).trim() ||
    `Linked subject ${String((element.slotIndex ?? index) + 1)}`
  );
};
