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

export const readPulsePresetIdFromSessionNamespace = (value: string | null): string | null => {
  if (!value) return null;
  const marker = "::pulse:";
  const markerIndex = value.indexOf(marker);
  if (markerIndex < 0) return null;
  const pulseScope = value.slice(markerIndex + marker.length);
  const presetId = pulseScope.split(":")[0]?.trim() ?? "";
  return presetId || null;
};

export const hasInboundStudioAgentCanonicalPrompt = (
  body: StudioAgentRequestBody | null | undefined
): boolean => typeof body?.canonicalPrompt === "string" && body.canonicalPrompt.trim().length > 0;
