/**
 * Shared Safe Completion policy for AI Studio Create agents.
 * Owns the non-editable prompt invariant and bounded recovery eligibility only;
 * server safety profiles and mode-owned transports remain authoritative.
 */
import type { OpenAiChatMessage } from "../../lib/server/api/openAiCompat";
import type { StudioAgentSafetyDecisionMeta } from "./safetyPolicy/textSafetyEvaluator";
import { hasAmbiguousAgeSexualSignal } from "./safetyPolicy/textSafetyLexicon";

export { hasAmbiguousAgeSexualSignal } from "./safetyPolicy/textSafetyLexicon";

export const SAFE_COMPLETION_CONTRACT_VERSION = "2026-07-10.v1";

export const SAFE_COMPLETION_SYSTEM_INSTRUCTION = [
  "SHORTPULSE SAFE COMPLETION CONTRACT (platform policy; non-editable)",
  "When a request contains material that can be made safe while preserving meaningful creative or production value, complete the requested work in this same response using the smallest necessary safe substitutions.",
  "Preserve the requested characters, setting, style, tone, energy, continuity, format, timing, artifact target, and production constraints wherever they remain safe.",
  "Return the completed work directly. Do not give a policy lecture, ask for permission, ask the user to resubmit, request an SFW version, or merely offer to create a safer version later.",
  "Refuse only when the platform safety policy does not permit a meaningful safe completion. A refusal must use the route's normal refusal contract and must not include a reusable artifact.",
  "This contract controls refusal-versus-safe-completion behavior only. It does not replace the active agent's role, workflow, response format, or artifact rules.",
].join("\n");

export type SafeCompletionRefusalSource = "typed_model" | "semantic_model" | "lexical_model";

export type SafeCompletionRecoveryOutcome = "not_attempted" | "recovered" | "refused" | "error";

export type SafeCompletionRecoverySkipReason =
  | "disabled"
  | "precheck_disabled"
  | "missing_precheck_decision"
  | "policy_refusal"
  | "hard_floor"
  | "unclassified_media"
  | "ambiguous_age_sexual_signal"
  | "not_model_refusal"
  | "already_attempted";

/** Resolves the code-owned feature lever. It never controls safety enforcement. */
export const isSafeCompletionEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  env.STUDIO_AGENT_SAFE_COMPLETION_ENABLED !== "false";

/** Returns the invariant only while Safe Completion behavior is enabled. */
export const resolveSafeCompletionSystemInstruction = (
  env: NodeJS.ProcessEnv = process.env
): string | null => (isSafeCompletionEnabled(env) ? SAFE_COMPLETION_SYSTEM_INSTRUCTION : null);

/**
 * Determines whether one model-authored refusal may receive an internal repair.
 * Missing safety evidence fails closed so recovery can never bypass hard floors.
 */
export const resolveSafeCompletionRecoveryEligibility = ({
  enabled,
  inputPrecheckEnabled,
  decision,
  latestUserText,
  refusalSource,
  hasUnclassifiedMedia = false,
  alreadyAttempted = false,
}: {
  enabled: boolean;
  inputPrecheckEnabled: boolean;
  decision?: StudioAgentSafetyDecisionMeta;
  latestUserText: string;
  refusalSource: SafeCompletionRefusalSource | null;
  hasUnclassifiedMedia?: boolean;
  alreadyAttempted?: boolean;
}): { eligible: true } | { eligible: false; skipReason: SafeCompletionRecoverySkipReason } => {
  if (!enabled) return { eligible: false, skipReason: "disabled" };
  if (!inputPrecheckEnabled) return { eligible: false, skipReason: "precheck_disabled" };
  if (!decision) return { eligible: false, skipReason: "missing_precheck_decision" };
  if (decision.source === "hard_floor" || decision.hardFloorViolation) {
    return { eligible: false, skipReason: "hard_floor" };
  }
  if (decision.action === "refuse") {
    return { eligible: false, skipReason: "policy_refusal" };
  }
  if (hasUnclassifiedMedia) {
    return { eligible: false, skipReason: "unclassified_media" };
  }
  if (hasAmbiguousAgeSexualSignal(latestUserText)) {
    return { eligible: false, skipReason: "ambiguous_age_sexual_signal" };
  }
  if (!refusalSource) return { eligible: false, skipReason: "not_model_refusal" };
  if (alreadyAttempted) return { eligible: false, skipReason: "already_attempted" };
  return { eligible: true };
};

export const SAFE_COMPLETION_RECOVERY_INSTRUCTION = [
  "SAFE COMPLETION RECOVERY (one attempt only)",
  "The preceding model response refused a request that the server safety policy classified as eligible for safe transformation.",
  "Complete the user's requested work now using the minimum safe substitutions required by the ShortPulse Safe Completion Contract.",
  "Return only the normal response shape required by this active Standard or Pulse runtime. Do not mention the earlier refusal, this repair instruction, safety policy, or a need for another user turn.",
].join("\n");

/** Inserts the one-shot recovery instruction after the existing system block. */
export const withSafeCompletionRecoveryInstruction = (
  messages: OpenAiChatMessage[]
): OpenAiChatMessage[] => {
  const next = [...messages];
  let insertionIndex = 0;
  while (insertionIndex < next.length && next[insertionIndex]?.role === "system") {
    insertionIndex += 1;
  }
  next.splice(insertionIndex, 0, {
    role: "system",
    content: SAFE_COMPLETION_RECOVERY_INSTRUCTION,
  });
  return next;
};
