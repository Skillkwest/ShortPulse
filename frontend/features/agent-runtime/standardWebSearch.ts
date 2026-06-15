/**
 * Standard agent web-search eligibility helpers shared by the server runtime
 * and the Standard Create UI status label.
 */
export type StudioAgentStandardWebSearchMode = "off" | "auto" | "intent" | "required";

export type StandardWebSearchFlow = "TEXT_ONLY" | "MIXED";

export type StandardWebSearchToolChoice = "auto" | "required";

/**
 * Returns whether a Standard text turn is likely asking for current or web-backed information.
 */
export const isLikelyStandardWebSearchRequest = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) {
    return false;
  }
  return /\b(current|latest|recent|today|tonight|this week|this month|news|updated?|up[- ]to[- ]date|look up|search|web|internet|source|sources|research|verify|fact[- ]check|fact check|price|pricing|law|legal|regulation|api docs|documentation|released?|available|model availability)\b/.test(
    normalized
  );
};

/**
 * Resolves whether a Standard turn should expose OpenAI web search.
 */
export const resolveStandardWebSearchToolChoice = ({
  flow,
  latestUserText,
  mode,
}: {
  flow: StandardWebSearchFlow;
  latestUserText: string;
  mode: StudioAgentStandardWebSearchMode;
}): StandardWebSearchToolChoice | null => {
  if (mode === "off" || flow !== "TEXT_ONLY") {
    return null;
  }
  if (mode === "required") {
    return "required";
  }
  if (mode === "auto") {
    return "auto";
  }
  return isLikelyStandardWebSearchRequest(latestUserText) ? "required" : null;
};

/**
 * Parses a Standard web-search mode value with an explicit enabled gate.
 */
export const resolveStandardWebSearchMode = ({
  value,
  enabled,
}: {
  value: string | undefined;
  enabled: boolean;
}): StudioAgentStandardWebSearchMode => {
  if (!enabled) return "off";
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "off" ||
    normalized === "auto" ||
    normalized === "intent" ||
    normalized === "required"
  ) {
    return normalized;
  }
  return "intent";
};

/**
 * Resolves the client-visible status mode. Production can disable this mirror
 * with `NEXT_PUBLIC_STUDIO_AGENT_STANDARD_WEB_SEARCH_ENABLED=false`; otherwise
 * it follows the production default where Standard web search is enabled.
 */
export const resolveStandardWebSearchUiMode = (
  env: Record<string, string | undefined> = process.env
): StudioAgentStandardWebSearchMode => {
  const enabledValue =
    env.NEXT_PUBLIC_STUDIO_AGENT_STANDARD_WEB_SEARCH_ENABLED?.trim().toLowerCase();
  return resolveStandardWebSearchMode({
    value: env.NEXT_PUBLIC_STUDIO_AGENT_STANDARD_WEB_SEARCH_MODE,
    enabled: enabledValue !== "false",
  });
};
