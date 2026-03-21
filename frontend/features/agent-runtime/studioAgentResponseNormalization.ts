import type { AgentResponse } from "../../prefabs/agent";
import { sanitizeGenerationPromptText } from "../agent-core/promptText";
import { STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE } from "./studioAgentRouteOutcomes";

type ParsedAgentJson = {
  response: AgentResponse;
  status: string | null;
};

type ParsedAgentSemanticOutput = {
  status: "ready" | "refuse";
  promptText: string;
};

const UNSTRUCTURED_PROMPT_PREFIX_PATTERNS: RegExp[] = [
  /^\s*(?:here(?:'s| is)|below is)\s+(?:your\s+)?(?:revised|updated|final|enhanced)?\s*prompt\s*[:-]\s*/i,
  /^\s*(?:revised|updated|final|enhanced)\s+prompt\s*[:-]\s*/i,
  /^\s*prompt\s*[:-]\s*/i,
];

const UNSTRUCTURED_REFUSAL_PATTERNS: RegExp[] = [
  /^\s*i\s*(?:cannot|can't|can not|am unable to|won't|will not)\b/i,
  /\b(?:cannot|can't|unable to|won't|will not)\s+(?:comply|assist|help|process|provide|rewrite|describe|generate|create)\b/i,
  /\bsafety\s+policy\b/i,
  /\bcontent\s+policy\b/i,
];

const stripUnstructuredPromptPreamble = (value: string): string => {
  let next = value;
  UNSTRUCTURED_PROMPT_PREFIX_PATTERNS.forEach((pattern) => {
    next = next.replace(pattern, "");
  });
  return next.trim();
};

const isLikelyUnstructuredRefusal = (value: string): boolean => {
  const normalized = value.trim();
  if (!normalized.length) return false;
  if (normalized === STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE) return true;
  return UNSTRUCTURED_REFUSAL_PATTERNS.some((pattern) => pattern.test(normalized));
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

  if (!cleanedApplyPrompt) {
    return undefined;
  }
  return {
    applyPrompt: cleanedApplyPrompt,
  };
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

const pushUniqueCandidate = (candidates: string[], value: string) => {
  const trimmed = value.trim();
  if (!trimmed.length || candidates.includes(trimmed)) return;
  candidates.push(trimmed);
};

const extractBalancedJsonObjectCandidates = (input: string): string[] => {
  const candidates: string[] = [];
  let depth = 0;
  let startIndex = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      if (depth === 0) startIndex = index;
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && startIndex >= 0) {
        pushUniqueCandidate(candidates, input.slice(startIndex, index + 1));
        startIndex = -1;
      }
    }
  }

  return candidates;
};

const collectJsonCandidates = (raw: unknown): string[] => {
  const candidates: string[] = [];
  const trimmed = extractStudioAgentCompletionText(raw).trim();
  if (!trimmed.length) return candidates;

  pushUniqueCandidate(candidates, trimmed);

  const fencedPattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencedPattern)) {
    const fencedContent = match[1];
    if (typeof fencedContent === "string") {
      pushUniqueCandidate(candidates, fencedContent);
    }
  }

  for (const candidate of extractBalancedJsonObjectCandidates(trimmed)) {
    pushUniqueCandidate(candidates, candidate);
  }

  return candidates;
};

const parseStudioAgentUnstructuredText = (raw: unknown): ParsedAgentJson | null => {
  const rawText = extractStudioAgentCompletionText(raw).trim();
  if (!rawText.length) return null;

  const strippedText = stripUnstructuredPromptPreamble(rawText);
  const promptText = sanitizeGenerationPromptText(strippedText);
  if (!promptText?.trim().length) return null;

  if (isLikelyUnstructuredRefusal(rawText) || isLikelyUnstructuredRefusal(promptText)) {
    return {
      status: "refuse",
      response: {
        message: promptText,
        actions: undefined,
      },
    };
  }

  return {
    status: "ready",
    response: {
      message: promptText,
      actions: { applyPrompt: promptText },
    },
  };
};

export const parseStudioAgentJsonWithStatus = (raw: unknown): ParsedAgentJson | null => {
  const candidates = collectJsonCandidates(raw);

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
      if (!message.length && !actions?.applyPrompt) {
        continue;
      }
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
  return parseStudioAgentUnstructuredText(raw);
};

export const parseStudioAgentJson = (raw: unknown): AgentResponse | null =>
  parseStudioAgentJsonWithStatus(raw)?.response ?? null;

export const parseStudioAgentSemanticOutput = (raw: unknown): ParsedAgentSemanticOutput | null => {
  const candidates = collectJsonCandidates(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== "object") continue;
      const record = parsed as Record<string, unknown>;
      const rawStatus = typeof record.status === "string" ? record.status.trim().toLowerCase() : "";
      if (rawStatus !== "ready" && rawStatus !== "refuse") continue;
      const promptText = sanitizeGenerationPromptText(
        typeof record.prompt_text === "string"
          ? record.prompt_text
          : typeof record.promptText === "string"
            ? record.promptText
            : typeof record.prompt === "string"
              ? record.prompt
              : typeof record.message === "string"
                ? record.message
                : null
      );
      const normalizedPrompt = promptText?.trim() ?? "";
      if (!normalizedPrompt.length) continue;
      return {
        status: rawStatus,
        promptText: normalizedPrompt,
      };
    } catch {
      continue;
    }
  }
  if (candidates.length > 0) {
    return null;
  }
  const unstructured = parseStudioAgentUnstructuredText(raw);
  if (!unstructured) return null;
  return {
    status: unstructured.status === "refuse" ? "refuse" : "ready",
    promptText: unstructured.response.message,
  };
};

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
    parsed.actions = { applyPrompt: resolvedFallback };
  } else {
    parsed.actions = { applyPrompt: cleanedApplyPrompt };
  }
  parsed.message =
    parsed.actions?.applyPrompt ??
    sanitizeGenerationPromptText(parsed.message ?? null) ??
    resolvedFallback;
  return parsed;
};

export const buildStudioAgentSemanticResponse = ({
  semantic,
}: {
  semantic: ParsedAgentSemanticOutput;
}): { parsed: AgentResponse; status: string | null } => {
  if (semantic.status === "refuse") {
    return {
      parsed: {
        message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
        actions: undefined,
      },
      status: "refuse",
    };
  }

  return {
    parsed: {
      message: semantic.promptText,
      actions: {
        applyPrompt: semantic.promptText,
      },
    },
    status: "ready",
  };
};
