/**
 * Customer-facing provider text helpers.
 * Sanitizes provider/runtime copy and extracts readable messages from structured error payloads.
 */
const AUDIO_SERVICE_LABEL = "the audio service";
const GENERATION_SERVICE_LABEL = "the generation service";

const SAFETY_VIOLATIONS_PATTERN = /\bsafety_violations\s*=\s*\[([^\]]*)\]/i;
const PROVIDER_SUPPORT_TEXT_PATTERN =
  /\bIf\s+you\s+believe\s+this\s+is\s+an\s+error,?\s+contact\s+(?:us|support)\b[^.?!]*(?:[.?!]|$)/gi;
const CONTACT_SUPPORT_TEXT_PATTERN = /\bcontact\s+(?:us|support)\b[^.?!]*(?:[.?!]|$)/gi;
const REQUEST_ID_TEXT_PATTERN = /\b(?:and\s+)?include\s+the\s+request\s+ID\s+[a-z0-9_:-]+\.?/gi;
const REQUEST_ID_INLINE_PATTERN = /\brequest\s+ID\s*[:#]?\s*[a-z0-9_:-]+\.?/gi;
const PROVIDER_REQUEST_TOKEN_PATTERN = /\breq_[a-z0-9]+\b/gi;
const SUPPORT_URL_PATTERN = /\b(?:https?:\/\/)?help\.openai\.com\S*/gi;

const providerTextReplacements: Array<[RegExp, string]> = [
  [
    /ELEVENLABS_API_KEY\s+is\s+not\s+configured\.?/gi,
    "Audio generation is temporarily unavailable.",
  ],
  [/Eleven\s*Labs\s+Sound\s+Effects/gi, "Sound Effects"],
  [/Eleven\s*Labs\s+Voice\s+Changer/gi, "Voice Changer"],
  [/Eleven\s*Labs\s+Voice\s+Design/gi, "Voice Design"],
  [/Eleven\s*Labs\s+Voiceover/gi, "Voiceover"],
  [/Eleven\s*Labs\s+Music/gi, "Music"],
  [/Eleven\s*Labs\s+account/gi, "ShortPulse voice library"],
  [/elevenlabs[/:][a-z0-9_-]+/gi, "the selected audio model"],
  [/Eleven\s*Labs/gi, AUDIO_SERVICE_LABEL],
  [/elevenlabs/gi, AUDIO_SERVICE_LABEL],
  [/11\s*labs/gi, AUDIO_SERVICE_LABEL],
  [/\bOpenAI\s+provider\s+down\b/gi, "The image service is temporarily unavailable."],
  [/\bprovider\s+down\b/gi, "The generation service is temporarily unavailable."],
  [/fal(\.ai)?/gi, GENERATION_SERVICE_LABEL],
  [/api\.openai\.com/gi, "the image service"],
  [/\bOpenAI\b/gi, "the image service"],
  [/\bprovider\b/gi, GENERATION_SERVICE_LABEL],
  [/api\.elevenlabs\.io/gi, AUDIO_SERVICE_LABEL],
  [
    /eleven_(?:multilingual(?:_sts|_ttv)?|text_to_sound)[a-z0-9_]*|music_v1/gi,
    "the selected audio model",
  ],
  [/xi-api-key/gi, "audio service credentials"],
];

const normalizeSafetyViolationReason = (value: string): string =>
  value.replace(/["'`]/g, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

const resolveSafetyRejectionMessage = (value: string): string | null => {
  const safetyMatch = value.match(SAFETY_VIOLATIONS_PATTERN);
  const hasSafetyLanguage = /\bsafety\s+(?:system|policy|violation|violations)\b/i.test(value);
  if (!safetyMatch && !hasSafetyLanguage) return null;

  const reasons = (safetyMatch?.[1] ?? "")
    .split(/[,\s]+/)
    .map(normalizeSafetyViolationReason)
    .filter(Boolean)
    .filter((reason, index, array) => array.indexOf(reason) === index);

  return reasons.length > 0
    ? `Your request was blocked by the safety system. Reason: ${reasons.join(", ")}.`
    : "Your request was blocked by the safety system.";
};

const stripProviderOperationalDetails = (value: string): string =>
  value
    .replace(PROVIDER_SUPPORT_TEXT_PATTERN, "")
    .replace(CONTACT_SUPPORT_TEXT_PATTERN, "")
    .replace(REQUEST_ID_TEXT_PATTERN, "")
    .replace(REQUEST_ID_INLINE_PATTERN, "")
    .replace(PROVIDER_REQUEST_TOKEN_PATTERN, "")
    .replace(SUPPORT_URL_PATTERN, "")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

export const sanitizeCustomerFacingProviderText = (
  value: string | null | undefined,
  fallback = "Audio generation failed."
): string => {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  const safetyMessage = resolveSafetyRejectionMessage(trimmed);
  if (safetyMessage) return safetyMessage;

  const sanitized = providerTextReplacements.reduce(
    (nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement),
    trimmed
  );

  return stripProviderOperationalDetails(sanitized) || fallback;
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const stripHiddenVideoProviderBranding = (value: string): string =>
  collapseWhitespace(
    value
      .replace(/\s+\((?:Kie|Kai(?:\.ai)?|Chi(?:\.ai)?)\)/gi, "")
      .replace(/\b(?:Kie|Chi) AI\b/gi, "")
      .replace(/\b(?:Kie|Chi) (?=(?:VEO|Veo|Kling|Seedance|temporary upload failed\b))/gi, "")
      .replace(/\bVEO\b/g, "Veo")
      .replace(/\bI2V\b/gi, "")
  );

const humanizeIdentifier = (value: string): string =>
  collapseWhitespace(value.replace(/[_-]+/g, " "));

const toSentence = (value: string): string => {
  const normalized = collapseWhitespace(value);
  if (!normalized) return normalized;
  const maybeHumanized = /^[a-z0-9_-]+$/i.test(normalized)
    ? humanizeIdentifier(normalized)
    : normalized;
  return maybeHumanized.charAt(0).toUpperCase() + maybeHumanized.slice(1);
};

const ensureSentencePunctuation = (value: string): string =>
  /[.!?]$/.test(value) ? value : `${value}.`;

const shouldHumanizeIdentifier = (value: string): boolean =>
  !/\s/.test(value) && /[_-]/.test(value);

const humanizeFieldLabel = (value: string): string =>
  toSentence(value)
    .replace(/\bUrls\b/g, "URLs")
    .replace(/\bUrl\b/g, "URL")
    .replace(/\bIds\b/g, "IDs")
    .replace(/\bId\b/g, "ID");

const extractFieldLabel = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    const parts = value
      .map((part) => (typeof part === "string" || typeof part === "number" ? String(part) : ""))
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .filter((part) => !["body", "input", "payload"].includes(part.toLowerCase()));
    const lastPart = parts[parts.length - 1];
    return lastPart ? humanizeFieldLabel(lastPart) : null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? humanizeFieldLabel(trimmed) : null;
  }
  return null;
};

const formatFieldMessage = (fieldLabel: string, message: string): string => {
  const normalizedMessage = collapseWhitespace(message);
  if (/^(field required|missing required field)$/i.test(normalizedMessage)) {
    return `${fieldLabel} is required.`;
  }
  if (normalizedMessage.toLowerCase().startsWith(fieldLabel.toLowerCase())) {
    return ensureSentencePunctuation(normalizedMessage);
  }
  return ensureSentencePunctuation(`${fieldLabel}: ${normalizedMessage}`);
};

const extractStructuredProviderError = (value: unknown, depth = 0): string | null => {
  if (depth > 4 || value == null) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return extractStructuredProviderError(JSON.parse(trimmed), depth + 1) ?? trimmed;
      } catch {
        return shouldHumanizeIdentifier(trimmed) ? humanizeIdentifier(trimmed) : trimmed;
      }
    }
    return shouldHumanizeIdentifier(trimmed) ? humanizeIdentifier(trimmed) : trimmed;
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => extractStructuredProviderError(entry, depth + 1))
      .filter((entry): entry is string => Boolean(entry))
      .filter((entry, index, array) => array.indexOf(entry) === index);
    return parts.length > 0 ? parts.join(" ") : null;
  }

  if (typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  const fieldLabel = extractFieldLabel(record.loc ?? record.field ?? record.path);

  if (Array.isArray(record.detail)) {
    const detailMessages = record.detail
      .map((entry) => extractStructuredProviderError(entry, depth + 1))
      .filter((entry): entry is string => Boolean(entry))
      .filter((entry, index, array) => array.indexOf(entry) === index);
    if (detailMessages.length > 0) {
      return detailMessages.join(" ");
    }
  }

  const directMessage =
    extractStructuredProviderError(record.msg, depth + 1) ??
    extractStructuredProviderError(record.message, depth + 1) ??
    extractStructuredProviderError(record.error, depth + 1) ??
    extractStructuredProviderError(record.reason, depth + 1) ??
    extractStructuredProviderError(record.failure, depth + 1) ??
    extractStructuredProviderError(record.description, depth + 1) ??
    extractStructuredProviderError(record.title, depth + 1);

  if (fieldLabel && directMessage) {
    return formatFieldMessage(fieldLabel, directMessage);
  }

  const nestedDetail = extractStructuredProviderError(record.detail, depth + 1);
  if (fieldLabel && nestedDetail) {
    return formatFieldMessage(fieldLabel, nestedDetail);
  }
  if (directMessage) return directMessage;
  if (nestedDetail) return nestedDetail;
  if (fieldLabel) return `${fieldLabel} is invalid.`;
  return null;
};

export const extractCustomerFacingProviderError = (value: unknown): string | null => {
  const extracted = extractStructuredProviderError(value);
  if (!extracted) return null;
  const sanitized = sanitizeCustomerFacingProviderText(extracted, extracted);
  return stripHiddenVideoProviderBranding(sanitized) || null;
};

export const normalizeCustomerFacingProviderError = (
  value: unknown,
  fallback = "Generation failed."
): string => extractCustomerFacingProviderError(value) ?? fallback;

export const resolveCustomerFacingModelLabel = ({
  model,
  modelId,
  resolveModelLabel,
  fallback = "Generation",
}: {
  model?: string | null;
  modelId?: string | null;
  resolveModelLabel?: (modelId: string) => string | null | undefined;
  fallback?: string;
}): string => {
  const normalizedModelId = modelId?.trim() ?? "";
  const labelFromId = normalizedModelId ? resolveModelLabel?.(normalizedModelId)?.trim() : "";
  const sanitized = sanitizeCustomerFacingProviderText(
    labelFromId || model || normalizedModelId,
    fallback
  );
  return stripHiddenVideoProviderBranding(sanitized) || fallback;
};
