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

export const parseStudioAgentSemanticOutput = (raw: unknown): ParsedAgentSemanticOutput | null => {
  const candidates: string[] = [];
  const trimmed = extractStudioAgentCompletionText(raw).trim();
  if (trimmed) candidates.push(trimmed);
  const braceMatch = trimmed.match(/{[\s\S]*}/);
  if (braceMatch) candidates.push(braceMatch[0]);

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
  return null;
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
