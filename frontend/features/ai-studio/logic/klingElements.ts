/**
 * Shared Kling element selection contract for AI Studio video workflows.
 * Keeps saved Elements-library metadata attached to the submission-facing media fields.
 */
import { randomId } from "./ids";
import type { CharacterProfileImageTransform } from "../../character-manager/types";
import { deriveElementAliasFromName } from "../../elements-manager/logic/elementAlias";
import type { ElementProfileImageTransform } from "../../elements-manager/types";

export type AiStudioKlingEntitySourceKind = "element" | "character";
export type AiStudioKlingProfileImageTransform =
  | ElementProfileImageTransform
  | CharacterProfileImageTransform;

export type AiStudioKlingElement = {
  id: string;
  slotIndex?: number;
  sourceKind?: AiStudioKlingEntitySourceKind | null;
  sourceElementId?: string | null;
  sourceCharacterId?: string | null;
  name?: string;
  // Legacy compatibility token retained for older prompts and restored sessions.
  alias?: string;
  description?: string;
  profileImageUrl?: string | null;
  profileImageTransform?: AiStudioKlingProfileImageTransform | null;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
};

export const createEmptyAiStudioKlingElement = (): AiStudioKlingElement => ({
  id: randomId(),
  slotIndex: undefined,
  sourceKind: null,
  sourceElementId: null,
  sourceCharacterId: null,
  name: "",
  alias: "",
  description: "",
  profileImageUrl: null,
  profileImageTransform: null,
  frontalImageUrl: "",
  referenceImageUrls: "",
  videoUrl: "",
});

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
  allElements?: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind">>
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
  _allElements?: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">>
): string => {
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
  allElements?: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">>
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
  allElements?: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">>
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
  allElements?: Array<Pick<AiStudioKlingElement, "alias" | "name" | "sourceKind" | "slotIndex">>
): string => {
  const name = element.name?.trim();
  if (name) return name;
  return (
    resolveAiStudioKlingElementToken(element, index, allElements).trim() ||
    `Linked subject ${String((element.slotIndex ?? index) + 1)}`
  );
};
