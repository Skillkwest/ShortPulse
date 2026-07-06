/**
 * Route-boundary helpers for AI Studio Create agent mode isolation.
 * Keeps Standard and Pulse request continuity from sharing session or canonical prompt state.
 */

type StudioAgentRequestBody = {
  context?: unknown;
  clientSessionNamespace?: unknown;
  canonicalPrompt?: unknown;
};

const RETIRED_CREATE_PULSE_PRESET_IDS = new Set([
  "custom_1",
  "custom_2",
  "custom_3",
  "prompt_modifier",
  "legacy_prompt_modifier",
  "single_shot",
  "ad_hook",
  "product_hero",
  "ugc_style",
  "before_after",
  "lifestyle_scene",
]);

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

export const readPulsePresetIdFromContext = (context: unknown): string | null => {
  const pulse =
    context && typeof context === "object" && !Array.isArray(context)
      ? (context as { pulse?: { presetId?: unknown } | null }).pulse
      : null;
  const presetId = typeof pulse?.presetId === "string" ? pulse.presetId.trim() : "";
  return presetId || null;
};

export const isRetiredCreatePulsePresetId = (value: string | null | undefined): boolean =>
  typeof value === "string" && RETIRED_CREATE_PULSE_PRESET_IDS.has(value.trim());

export const hasInboundStudioAgentCanonicalPrompt = (
  body: StudioAgentRequestBody | null | undefined
): boolean => typeof body?.canonicalPrompt === "string" && body.canonicalPrompt.trim().length > 0;
