import type { AgentActions, AgentResponse } from "../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";

type ParsedAgentJson = {
  response: AgentResponse;
  status: string | null;
};

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0
  );
  return cleaned.length ? cleaned : undefined;
};

const asReferenceCard = (value: unknown): AgentActions["referenceCard"] | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.prompt !== "string" || !record.prompt.trim()) return undefined;
  return {
    title: typeof record.title === "string" ? record.title : undefined,
    prompt: record.prompt,
  };
};

const normalizeAgentActions = (value: unknown): AgentResponse["actions"] => {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const applyPrompt =
    typeof record.applyPrompt === "string"
      ? record.applyPrompt
      : typeof record.apply_prompt === "string"
        ? record.apply_prompt
        : undefined;

  const cleanedApplyPrompt = sanitizeGenerationPromptText(applyPrompt ?? null) ?? undefined;

  const normalized = {
    applyPrompt: cleanedApplyPrompt,
    variations:
      asStringArray(record.variations)
        ?.map((variation) => sanitizeGenerationPromptText(variation))
        .filter((variation): variation is string => Boolean(variation)) ?? undefined,
    describeTargets: asStringArray(record.describeTargets ?? record.describe_targets),
    referenceCard: (() => {
      const card = asReferenceCard(record.referenceCard);
      if (!card) return undefined;
      const prompt = sanitizeGenerationPromptText(card.prompt ?? null);
      if (!prompt) return undefined;
      return { ...card, prompt };
    })(),
  };

  if (
    !normalized.applyPrompt &&
    !normalized.variations &&
    !normalized.describeTargets &&
    !normalized.referenceCard
  ) {
    return undefined;
  }

  return normalized;
};

export const extractStudioAgentCompletionText = (rawContent: unknown): string => {
  if (typeof rawContent === "string") return rawContent;
  if (!Array.isArray(rawContent)) return "";
  return rawContent
    .map((part) => {
      const record = part && typeof part === "object" ? (part as Record<string, unknown>) : {};
      return typeof record.text === "string" ? record.text : "";
    })
    .join("\n")
    .trim();
};

export const parseStudioAgentJsonWithStatus = (raw: unknown): ParsedAgentJson | null => {
  const candidates: string[] = [];
  const trimmed = extractStudioAgentCompletionText(raw).trim();
  if (trimmed) candidates.push(trimmed);
  const braceMatch = trimmed.match(/{[\s\S]*}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const parsedRecord = parsed as Record<string, unknown>;
      const message =
        typeof parsedRecord.message === "string"
          ? (sanitizeGenerationPromptText(parsedRecord.message) ?? "")
          : "";
      const actions = normalizeAgentActions(parsedRecord.actions);
      const usageRecord =
        parsedRecord.usage && typeof parsedRecord.usage === "object"
          ? (parsedRecord.usage as Record<string, unknown>)
          : null;
      const usage = usageRecord
        ? {
            inputTokens:
              typeof usageRecord.inputTokens === "number"
                ? usageRecord.inputTokens
                : typeof usageRecord.input_tokens === "number"
                  ? usageRecord.input_tokens
                  : undefined,
            outputTokens:
              typeof usageRecord.outputTokens === "number"
                ? usageRecord.outputTokens
                : typeof usageRecord.output_tokens === "number"
                  ? usageRecord.output_tokens
                  : undefined,
          }
        : undefined;
      const status = typeof parsedRecord.status === "string" ? parsedRecord.status : null;
      return {
        response: { message, actions, usage },
        status,
      };
    } catch {
      continue;
    }
  }
  return null;
};

export const parseStudioAgentJson = (raw: unknown): AgentResponse | null =>
  parseStudioAgentJsonWithStatus(raw)?.response ?? null;

export const isStudioAgentRefusalResponse = ({
  status,
  response,
}: {
  status: string | null;
  response: AgentResponse;
}): boolean => {
  if (status?.toLowerCase() === "refuse") return true;
  const hasApplyPrompt = Boolean(response.actions?.applyPrompt?.trim());
  if (hasApplyPrompt) return false;
  const message = response.message?.trim() ?? "";
  if (!message.length) return false;
  return /(^|\s)(cannot|can't|unable|refuse|won't|not able)\b/i.test(message);
};

export const ensureStudioAgentApplyPromptContract = ({
  parsed,
  fallbackPrompt,
}: {
  parsed: AgentResponse;
  fallbackPrompt: string;
}): AgentResponse => {
  const resolvedFallback = sanitizeGenerationPromptText(fallbackPrompt) ?? "";
  const cleanedApplyPrompt = sanitizeGenerationPromptText(parsed.actions?.applyPrompt ?? null);
  if (!cleanedApplyPrompt) {
    parsed.actions = parsed.actions ?? {};
    parsed.actions.applyPrompt = resolvedFallback;
  } else {
    parsed.actions = parsed.actions ?? {};
    parsed.actions.applyPrompt = cleanedApplyPrompt;
  }
  if (parsed.actions?.applyPrompt && !parsed.actions.referenceCard?.prompt) {
    parsed.actions.referenceCard = {
      title: "Prompt",
      prompt: parsed.actions.applyPrompt,
    };
  }
  parsed.message =
    parsed.actions?.applyPrompt ??
    sanitizeGenerationPromptText(parsed.message ?? null) ??
    resolvedFallback;
  return parsed;
};
