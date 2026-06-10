/**
 * Expert Edit prompt-reference token helpers.
 * Owns `@main` and `@imgN` parsing, validation, highlight segmentation, drag-drop token utilities,
 * and provider-facing prompt compilation.
 */
import { insertPromptTokenAtSelection } from "./promptTokenInsertion";
import { MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT } from "./expertEditReferenceSlots";

export const EXPERT_EDIT_PROMPT_TOKEN_TRANSFER_MIME = "text/ai-studio-expert-edit-img-token";
export const EXPERT_EDIT_PRIMARY_SLOT_TOKEN = "@main";
const EXPERT_EDIT_PROMPT_TOKEN_REGEX = /@(?:img\d*|main)/gi;
const VALID_IMG_TOKEN_REGEX = /^@img(\d+)$/i;
const MAX_SECONDARY_REFERENCES = MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT;
const MAX_EXPERT_EDIT_REFERENCE_INPUTS = 1 + MAX_EXPERT_EDIT_SECONDARY_SLOT_COUNT;

export type ExpertEditPromptTokenInvalidReason =
  | "missing_index"
  | "out_of_range"
  | "empty_slot"
  | "secondary_tokens_disabled"
  | "too_many_secondary_references";
export type ExpertEditPromptTokenKind = "primary" | "secondary";

export type ExpertEditPromptTokenAnalysisOptions = {
  allowSecondaryTokens?: boolean;
  maxSecondaryReferences?: number;
};

export type ExpertEditPromptTokenDiagnostic = {
  token: string;
  normalizedToken: string;
  start: number;
  end: number;
  kind: ExpertEditPromptTokenKind;
  slotIndex: number | null;
  isValid: boolean;
  invalidReason: ExpertEditPromptTokenInvalidReason | null;
};

export type ExpertEditPromptTokenAnalysis = {
  diagnostics: ExpertEditPromptTokenDiagnostic[];
  hasTokenReferences: boolean;
  hasInvalidTokens: boolean;
  referencedSlotIndexes: number[];
  inlineError: string | null;
};

export type ExpertEditPromptHighlightSegment = {
  text: string;
  kind: "plain" | "valid-token" | "invalid-token";
};

export type CompileExpertEditSubmissionPromptInput = {
  displayPrompt: string;
  secondarySlots: readonly (string | null)[];
  referenceInputs: string[];
  secondaryFigureNumbersBySlotIndex?: Partial<Record<number, number>>;
};

export type CompileExpertEditSubmissionPromptResult = {
  submissionPrompt: string;
  hasTokenReferences: boolean;
};

export type ExpertEditSubmissionReferencePlan = {
  referenceInputs: string[];
  secondaryFigureNumbersBySlotIndex: Partial<Record<number, number>>;
};

const normalizeSlotUrl = (value: string | null | undefined): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const buildInlineError = (
  diagnostic: ExpertEditPromptTokenDiagnostic,
  { allowSecondaryTokens = true, maxSecondaryReferences }: ExpertEditPromptTokenAnalysisOptions = {}
): string | null => {
  if (diagnostic.isValid) return null;
  if (!allowSecondaryTokens && diagnostic.invalidReason === "secondary_tokens_disabled") {
    return "Inpaint only supports @main. Secondary references are not sent to the inpaint model.";
  }
  if (
    diagnostic.invalidReason === "too_many_secondary_references" &&
    maxSecondaryReferences === 1
  ) {
    return `Reference inpaint supports only one secondary reference image. Use exactly one of ${buildSupportedImageTokenList()}.`;
  }
  if (diagnostic.invalidReason === "too_many_secondary_references") {
    return `Use no more than ${
      maxSecondaryReferences ?? MAX_SECONDARY_REFERENCES
    } secondary reference images in this prompt.`;
  }
  if (diagnostic.invalidReason === "missing_index") {
    return `Use @main or ${buildSupportedImageTokenList()} to reference an image.`;
  }
  if (diagnostic.invalidReason === "out_of_range") {
    return `${diagnostic.token} is out of range. Use @main or ${buildSupportedImageTokenList()}.`;
  }
  if (diagnostic.invalidReason === "empty_slot" && diagnostic.slotIndex != null) {
    return `@img${diagnostic.slotIndex + 1} has no image in secondary slot ${diagnostic.slotIndex + 1}.`;
  }
  return "Invalid image reference token.";
};

const buildSupportedImageTokenList = (): string =>
  Array.from({ length: MAX_SECONDARY_REFERENCES }, (_, index) => `@img${index + 1}`).join(", ");

const resolveSlotIndexFromToken = (token: string): number | null => {
  const match = token.match(VALID_IMG_TOKEN_REGEX);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(parsed)) return null;
  const index = parsed - 1;
  if (index < 0 || index >= MAX_SECONDARY_REFERENCES) return null;
  return index;
};

export const analyzeExpertEditPromptTokens = (
  prompt: string,
  secondarySlots: readonly (string | null)[],
  options?: ExpertEditPromptTokenAnalysisOptions
): ExpertEditPromptTokenAnalysis => {
  const { allowSecondaryTokens = true, maxSecondaryReferences } = options ?? {};
  const diagnostics: ExpertEditPromptTokenDiagnostic[] = [];
  const normalizedPrompt = typeof prompt === "string" ? prompt : "";
  const normalizedSlots = secondarySlots.map((value) => normalizeSlotUrl(value));
  const referencedSecondarySlotIndexes = new Set<number>();

  for (const match of normalizedPrompt.matchAll(EXPERT_EDIT_PROMPT_TOKEN_REGEX)) {
    const token = match[0] ?? "";
    const start = match.index ?? 0;
    const end = start + token.length;
    const normalizedToken = token.toLowerCase();

    if (normalizedToken === EXPERT_EDIT_PRIMARY_SLOT_TOKEN) {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "primary",
        slotIndex: null,
        isValid: true,
        invalidReason: null,
      });
      continue;
    }

    if (!allowSecondaryTokens) {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "secondary",
        slotIndex: resolveSlotIndexFromToken(token),
        isValid: false,
        invalidReason: "secondary_tokens_disabled",
      });
      continue;
    }

    const slotIndex = resolveSlotIndexFromToken(token);

    if (token.toLowerCase() === "@img") {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "secondary",
        slotIndex: null,
        isValid: false,
        invalidReason: "missing_index",
      });
      continue;
    }

    if (slotIndex == null) {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "secondary",
        slotIndex: null,
        isValid: false,
        invalidReason: "out_of_range",
      });
      continue;
    }

    if (!normalizedSlots[slotIndex]) {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "secondary",
        slotIndex,
        isValid: false,
        invalidReason: "empty_slot",
      });
      continue;
    }

    const wouldExceedSecondaryReferenceLimit =
      typeof maxSecondaryReferences === "number" &&
      maxSecondaryReferences >= 0 &&
      !referencedSecondarySlotIndexes.has(slotIndex) &&
      referencedSecondarySlotIndexes.size >= maxSecondaryReferences;
    if (wouldExceedSecondaryReferenceLimit) {
      diagnostics.push({
        token,
        normalizedToken,
        start,
        end,
        kind: "secondary",
        slotIndex,
        isValid: false,
        invalidReason: "too_many_secondary_references",
      });
      continue;
    }

    referencedSecondarySlotIndexes.add(slotIndex);

    diagnostics.push({
      token,
      normalizedToken,
      start,
      end,
      kind: "secondary",
      slotIndex,
      isValid: true,
      invalidReason: null,
    });
  }

  const hasTokenReferences = diagnostics.length > 0;
  const invalidDiagnostic = diagnostics.find((item) => !item.isValid) ?? null;
  const referencedSlotIndexes = Array.from(
    new Set(
      diagnostics
        .filter((item) => item.isValid && item.slotIndex != null)
        .map((item) => item.slotIndex as number)
    )
  ).sort((left, right) => left - right);

  return {
    diagnostics,
    hasTokenReferences,
    hasInvalidTokens: Boolean(invalidDiagnostic),
    referencedSlotIndexes,
    inlineError: invalidDiagnostic ? buildInlineError(invalidDiagnostic, options) : null,
  };
};

export const buildExpertEditSubmissionReferenceInputs = ({
  flattenedPrimaryUrl,
  flattenedMarkupReferenceUrl,
  secondarySlots,
  referencedSlotIndexes,
}: {
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
  secondarySlots: readonly (string | null)[];
  referencedSlotIndexes: number[];
}): string[] => {
  return buildExpertEditSubmissionReferencePlan({
    flattenedPrimaryUrl,
    flattenedMarkupReferenceUrl,
    secondarySlots,
    referencedSlotIndexes,
  }).referenceInputs;
};

/**
 * Builds the canonical provider reference input order and the slot -> figure map used by prompt compilation.
 */
export const buildExpertEditSubmissionReferencePlan = ({
  flattenedPrimaryUrl,
  flattenedMarkupReferenceUrl,
  secondarySlots,
  referencedSlotIndexes,
}: {
  flattenedPrimaryUrl: string | null;
  flattenedMarkupReferenceUrl?: string | null;
  secondarySlots: readonly (string | null)[];
  referencedSlotIndexes: number[];
}): ExpertEditSubmissionReferencePlan => {
  const referencedSecondaryUrls = referencedSlotIndexes.map(
    (slotIndex) => secondarySlots[slotIndex]
  );
  const referenceInputs: string[] = [];
  const secondaryFigureNumbersBySlotIndex: Partial<Record<number, number>> = {};
  const pushReferenceInput = (value: string | null | undefined): number | null => {
    const normalizedValue = normalizeSlotUrl(value);
    if (!normalizedValue.length) return null;
    if (referenceInputs.length >= MAX_EXPERT_EDIT_REFERENCE_INPUTS) {
      return null;
    }
    referenceInputs.push(normalizedValue);
    return referenceInputs.length;
  };

  pushReferenceInput(flattenedPrimaryUrl);
  pushReferenceInput(flattenedMarkupReferenceUrl ?? null);
  referencedSlotIndexes.forEach((slotIndex, index) => {
    const figureNumber = pushReferenceInput(referencedSecondaryUrls[index]);
    if (figureNumber == null) return;
    secondaryFigureNumbersBySlotIndex[slotIndex] = figureNumber;
  });

  return {
    referenceInputs,
    secondaryFigureNumbersBySlotIndex,
  };
};

export const buildExpertEditPromptHighlightSegments = (
  prompt: string,
  diagnostics: ExpertEditPromptTokenDiagnostic[]
): ExpertEditPromptHighlightSegment[] => {
  const normalizedPrompt = typeof prompt === "string" ? prompt : "";
  if (!normalizedPrompt.length) {
    return [{ text: "", kind: "plain" }];
  }
  if (!diagnostics.length) {
    return [{ text: normalizedPrompt, kind: "plain" }];
  }

  const sortedDiagnostics = [...diagnostics].sort((left, right) => left.start - right.start);
  const segments: ExpertEditPromptHighlightSegment[] = [];
  let cursor = 0;

  sortedDiagnostics.forEach((diagnostic) => {
    const start = Math.max(0, diagnostic.start);
    const end = Math.max(start, diagnostic.end);
    if (start > cursor) {
      segments.push({
        text: normalizedPrompt.slice(cursor, start),
        kind: "plain",
      });
    }
    const tokenText = normalizedPrompt.slice(start, end);
    segments.push({
      text: tokenText,
      kind: diagnostic.isValid ? "valid-token" : "invalid-token",
    });
    cursor = end;
  });

  if (cursor < normalizedPrompt.length) {
    segments.push({
      text: normalizedPrompt.slice(cursor),
      kind: "plain",
    });
  }

  return segments;
};

const resolveFigureNumberBySlotIndex = (
  slotIndex: number,
  secondarySlots: readonly (string | null)[],
  referenceInputs: string[],
  secondaryFigureNumbersBySlotIndex?: Partial<Record<number, number>>
): number | null => {
  const mappedFigureNumber = secondaryFigureNumbersBySlotIndex?.[slotIndex];
  if (typeof mappedFigureNumber === "number" && Number.isFinite(mappedFigureNumber)) {
    return mappedFigureNumber;
  }
  const slotUrl = normalizeSlotUrl(secondarySlots[slotIndex]);
  if (!slotUrl) return null;
  const inputIndex = referenceInputs.findIndex((value) => normalizeSlotUrl(value) === slotUrl);
  if (inputIndex < 0) return null;
  return inputIndex + 1;
};

const resolveFigureNumberByTokenKind = (
  diagnostic: ExpertEditPromptTokenDiagnostic,
  secondarySlots: readonly (string | null)[],
  referenceInputs: string[],
  secondaryFigureNumbersBySlotIndex?: Partial<Record<number, number>>
): number | null => {
  if (diagnostic.kind === "primary") {
    return 1;
  }
  if (diagnostic.slotIndex == null) return null;
  return resolveFigureNumberBySlotIndex(
    diagnostic.slotIndex,
    secondarySlots,
    referenceInputs,
    secondaryFigureNumbersBySlotIndex
  );
};

const appendFigureMap = ({
  prompt,
  diagnostics,
  secondarySlots,
  referenceInputs,
  secondaryFigureNumbersBySlotIndex,
}: {
  prompt: string;
  diagnostics: ExpertEditPromptTokenDiagnostic[];
  secondarySlots: readonly (string | null)[];
  referenceInputs: string[];
  secondaryFigureNumbersBySlotIndex?: Partial<Record<number, number>>;
}): string => {
  const hasPrimaryReference = diagnostics.some((item) => item.isValid && item.kind === "primary");
  const validSecondaryDiagnostics = diagnostics.filter(
    (item): item is ExpertEditPromptTokenDiagnostic & { slotIndex: number } =>
      item.isValid && item.slotIndex != null
  );
  if (!hasPrimaryReference && !validSecondaryDiagnostics.length) return prompt;

  const mapLines = new Map<string, string>();
  mapLines.set("figure1", "- Figure 1 = primary base image.");

  validSecondaryDiagnostics.forEach((diagnostic) => {
    const figureNumber = resolveFigureNumberBySlotIndex(
      diagnostic.slotIndex,
      secondarySlots,
      referenceInputs,
      secondaryFigureNumbersBySlotIndex
    );
    if (figureNumber == null) return;
    const token = `@img${diagnostic.slotIndex + 1}`;
    mapLines.set(
      `${figureNumber}:${diagnostic.slotIndex}`,
      `- Figure ${figureNumber} = ${token} secondary reference.`
    );
  });

  const mapBlockLines = ["Reference map:", ...Array.from(mapLines.values())];
  if (validSecondaryDiagnostics.length > 0) {
    mapBlockLines.push(
      "- Treat all secondary references as edits to Figure 1 unless explicitly overridden."
    );
  }
  const mapBlock = mapBlockLines.join("\n");

  return `${prompt}\n\n${mapBlock}`;
};

export const compileExpertEditSubmissionPrompt = ({
  displayPrompt,
  secondarySlots,
  referenceInputs,
  secondaryFigureNumbersBySlotIndex,
  options,
}: CompileExpertEditSubmissionPromptInput & {
  options?: ExpertEditPromptTokenAnalysisOptions;
}): CompileExpertEditSubmissionPromptResult => {
  const prompt = typeof displayPrompt === "string" ? displayPrompt : "";
  const analysis = analyzeExpertEditPromptTokens(prompt, secondarySlots, options);
  if (!analysis.hasTokenReferences || analysis.hasInvalidTokens) {
    return {
      submissionPrompt: prompt,
      hasTokenReferences: analysis.hasTokenReferences,
    };
  }

  const compiledPromptParts: string[] = [];
  let cursor = 0;
  analysis.diagnostics.forEach((diagnostic) => {
    compiledPromptParts.push(prompt.slice(cursor, diagnostic.start));
    if (diagnostic.isValid) {
      const figureNumber = resolveFigureNumberByTokenKind(
        diagnostic,
        secondarySlots,
        referenceInputs,
        secondaryFigureNumbersBySlotIndex
      );
      compiledPromptParts.push(figureNumber != null ? `Figure ${figureNumber}` : diagnostic.token);
    } else {
      compiledPromptParts.push(diagnostic.token);
    }
    cursor = diagnostic.end;
  });
  compiledPromptParts.push(prompt.slice(cursor));

  const replacedPrompt = compiledPromptParts.join("");
  const submissionPrompt = appendFigureMap({
    prompt: replacedPrompt,
    diagnostics: analysis.diagnostics,
    secondarySlots,
    referenceInputs,
    secondaryFigureNumbersBySlotIndex,
  });

  return {
    submissionPrompt,
    hasTokenReferences: true,
  };
};

export const buildExpertEditSecondarySlotToken = (slotIndex: number): string | null => {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_SECONDARY_REFERENCES) {
    return null;
  }
  return `@img${slotIndex + 1}`;
};

/**
 * Returns the canonical token for the primary image reference.
 */
export const buildExpertEditPrimarySlotToken = (): string => EXPERT_EDIT_PRIMARY_SLOT_TOKEN;

export const setExpertEditPromptTokenDragData = (
  transfer: DataTransfer,
  slotIndex: number
): string | null => {
  const token = buildExpertEditSecondarySlotToken(slotIndex);
  if (!token) return null;
  transfer.setData(EXPERT_EDIT_PROMPT_TOKEN_TRANSFER_MIME, token);
  transfer.setData("text/plain", token);
  return token;
};

export const extractExpertEditPromptTokenFromTransfer = (transfer: DataTransfer): string | null => {
  const customToken = transfer.getData(EXPERT_EDIT_PROMPT_TOKEN_TRANSFER_MIME).trim();
  if (VALID_IMG_TOKEN_REGEX.test(customToken) || customToken.toLowerCase() === "@main") {
    return customToken.toLowerCase();
  }
  const plainTextToken = transfer.getData("text/plain").trim();
  if (VALID_IMG_TOKEN_REGEX.test(plainTextToken) || plainTextToken.toLowerCase() === "@main") {
    return plainTextToken.toLowerCase();
  }
  return null;
};

export const resolveExpertEditPromptTokenSlotIndex = (token: string): number | null => {
  return resolveSlotIndexFromToken(token);
};

export const insertExpertEditPromptTokenAtSelection = insertPromptTokenAtSelection;
