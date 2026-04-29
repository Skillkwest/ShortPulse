/**
 * Route-boundary helpers for AI Studio Create agent mode isolation.
 * Keeps Standard and Pulse request continuity from sharing session or canonical prompt state.
 */

type StudioAgentRequestBody = {
  context?: unknown;
  clientSessionNamespace?: unknown;
  canonicalPrompt?: unknown;
};

export const hasStudioAgentPulseContext = (value: unknown): boolean =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "pulse" in value &&
    (value as { pulse?: unknown }).pulse != null
  );

export const readStudioAgentClientSessionNamespace = (
  body: StudioAgentRequestBody | null | undefined
): string | null => {
  const value = body?.clientSessionNamespace;
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
};

export const isStandardCreateAgentSessionNamespace = (value: string | null): boolean =>
  Boolean(value && value.endsWith("::standard"));

export const isPulseCreateAgentSessionNamespace = (value: string | null): boolean =>
  Boolean(value && value.includes("::pulse:"));

export const hasInboundStudioAgentCanonicalPrompt = (
  body: StudioAgentRequestBody | null | undefined
): boolean => typeof body?.canonicalPrompt === "string" && body.canonicalPrompt.trim().length > 0;
