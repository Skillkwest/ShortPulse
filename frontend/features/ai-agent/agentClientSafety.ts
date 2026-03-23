/**
 * Client-side safety helper functions for AI Agent turn submission.
 */
import type { AgentApiContext } from "../../prefabs/agent";
import { normalizeErrorText } from "../../lib/errorText";
import type { SafetyModality } from "../agent-runtime/safetyPolicy/types";

export const SAFETY_REFUSAL_MESSAGE = "I cannot describe this.";

export const resolveSafetyRefusalText = (value: unknown): typeof SAFETY_REFUSAL_MESSAGE | null => {
  const raw = normalizeErrorText(value, { fallback: "", maxLength: 120 });
  if (raw === SAFETY_REFUSAL_MESSAGE) return SAFETY_REFUSAL_MESSAGE;
  return null;
};

export const resolveClientSafetyModality = (
  context: AgentApiContext | undefined
): SafetyModality => {
  if (context?.mode === "video") return "video";
  if (context?.mode === "image") return "image";
  if ((context?.media?.length ?? 0) > 0) return "image";
  return "text";
};

export const isClientInputPrecheckEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false";

export const resolveClientSafetyProfileId = (): string | null =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null;

export const isClientDevAbsoluteZeroEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true";
