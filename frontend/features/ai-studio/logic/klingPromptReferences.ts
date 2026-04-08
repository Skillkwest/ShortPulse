/**
 * Kling prompt token drag helpers.
 * Owns the `@alias` drag/drop contract used by the video prompt surface.
 */
import type { PromptTokenHighlightSegment } from "./promptTokenHighlight";
import type { AiStudioKlingEntitySourceKind } from "./klingElements";

export const KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME = "text/ai-studio-kling-element-token";

const KLING_ELEMENT_PROMPT_TOKEN_REGEX = /@[A-Za-z0-9_-]+/g;
const normalizeKlingElementAlias = (alias: string): string => alias.trim().replace(/^@+/, "");

const isValidKlingElementToken = (value: string): boolean => /^@[^\s@]+$/.test(value.trim());

export type KlingPromptTokenDiagnostic = {
  token: string;
  normalizedToken: string;
  start: number;
  end: number;
  isValid: boolean;
  slotIndex: number | null;
  sourceKind: AiStudioKlingEntitySourceKind | null;
};

export type KlingPromptTokenSlot = {
  alias: string;
  sourceKind: AiStudioKlingEntitySourceKind | null;
};

export const buildKlingElementPromptToken = (alias: string): string | null => {
  const normalizedAlias = normalizeKlingElementAlias(alias);
  if (!normalizedAlias) return null;
  const token = `@${normalizedAlias}`;
  return isValidKlingElementToken(token) ? token : null;
};

export const setKlingElementPromptTokenDragData = (
  transfer: DataTransfer,
  alias: string
): string | null => {
  const token = buildKlingElementPromptToken(alias);
  if (!token) return null;
  transfer.setData(KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME, token);
  transfer.setData("text/plain", token);
  transfer.setData("text/prompt", token);
  return token;
};

export const extractKlingElementPromptTokenFromTransfer = (
  transfer: DataTransfer
): string | null => {
  const customToken = transfer.getData(KLING_ELEMENT_PROMPT_TOKEN_TRANSFER_MIME).trim();
  if (isValidKlingElementToken(customToken)) {
    return customToken;
  }
  const promptToken = transfer.getData("text/prompt").trim();
  if (isValidKlingElementToken(promptToken)) {
    return promptToken;
  }
  const plainTextToken = transfer.getData("text/plain").trim();
  if (isValidKlingElementToken(plainTextToken)) {
    return plainTextToken;
  }
  return null;
};

export const analyzeKlingPromptTokens = (
  prompt: string,
  attachedSlots: KlingPromptTokenSlot[]
): KlingPromptTokenDiagnostic[] => {
  const normalizedPrompt = typeof prompt === "string" ? prompt : "";
  const normalizedSlots = attachedSlots.map((slot, index) => ({
    alias: normalizeKlingElementAlias(slot.alias).toLowerCase(),
    sourceKind: slot.sourceKind ?? null,
    slotIndex: index,
  }));
  const diagnostics: KlingPromptTokenDiagnostic[] = [];

  for (const match of normalizedPrompt.matchAll(KLING_ELEMENT_PROMPT_TOKEN_REGEX)) {
    const token = match[0] ?? "";
    const normalizedToken = normalizeKlingElementAlias(token).toLowerCase();
    const start = match.index ?? 0;
    const matchingSlots = normalizedSlots.filter((slot) => slot.alias === normalizedToken);
    const preferredMatch =
      matchingSlots.find((slot) => slot.sourceKind === "character") ?? matchingSlots[0] ?? null;
    diagnostics.push({
      token,
      normalizedToken,
      start,
      end: start + token.length,
      isValid: Boolean(preferredMatch),
      slotIndex: preferredMatch?.slotIndex ?? null,
      sourceKind: preferredMatch?.sourceKind ?? null,
    });
  }

  return diagnostics;
};

export const buildKlingPromptHighlightSegments = (
  prompt: string,
  diagnostics: KlingPromptTokenDiagnostic[]
): PromptTokenHighlightSegment[] => {
  const normalizedPrompt = typeof prompt === "string" ? prompt : "";
  if (!normalizedPrompt.length) {
    return [{ text: "", kind: "plain" }];
  }
  if (!diagnostics.length) {
    return [{ text: normalizedPrompt, kind: "plain" }];
  }

  const segments: PromptTokenHighlightSegment[] = [];
  let cursor = 0;

  diagnostics.forEach((diagnostic) => {
    if (diagnostic.start > cursor) {
      segments.push({
        text: normalizedPrompt.slice(cursor, diagnostic.start),
        kind: "plain",
      });
    }

    segments.push({
      text: normalizedPrompt.slice(diagnostic.start, diagnostic.end),
      kind: diagnostic.isValid
        ? diagnostic.sourceKind === "character"
          ? "character-token"
          : "token"
        : "invalid-token",
    });
    cursor = diagnostic.end;
  });

  if (cursor < normalizedPrompt.length) {
    segments.push({
      text: normalizedPrompt.slice(cursor),
      kind: "plain",
    });
  }

  return segments;
};
