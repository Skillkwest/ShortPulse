/**
 * AI Studio pressure-conservation policy for nonessential browser work.
 * Keeps crash-adjacent pressure quarantine out of unrelated routes while
 * giving AI Studio background refresh loops one shared source of truth.
 */
import { resolveAiStudioPressureQuarantineLevel } from "./aiStudioStabilityTelemetry";

const AI_STUDIO_ROUTE_PREFIX = "/ai-studio";

const isAiStudioBrowserRoute = (): boolean => {
  if (typeof window === "undefined") return false;
  const pathname = window.location?.pathname ?? "";
  return pathname === AI_STUDIO_ROUTE_PREFIX || pathname.startsWith(`${AI_STUDIO_ROUTE_PREFIX}/`);
};

/**
 * Returns true when AI Studio should defer automatic background work.
 * Explicit user actions and required initial loads should continue to run.
 */
export const shouldDeferAiStudioBackgroundWork = (): boolean => {
  if (!isAiStudioBrowserRoute()) return false;
  return resolveAiStudioPressureQuarantineLevel() >= 2;
};
