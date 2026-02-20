/**
 * Central generation lifecycle transition guard.
 * Keep all legal state transitions in one place.
 */

export type GenerationLifecycleState = "submitted" | "running" | "success" | "fail";

const LEGAL_TRANSITIONS: Record<GenerationLifecycleState, ReadonlySet<GenerationLifecycleState>> = {
  submitted: new Set(["running", "fail"]),
  running: new Set(["success", "fail"]),
  success: new Set(),
  fail: new Set(),
};

export const normalizeGenerationLifecycleState = (
  value: unknown
): GenerationLifecycleState | null => {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!normalized) return null;
  if (normalized === "pending") return "submitted";
  if (normalized === "submitted") return "submitted";
  if (normalized === "running") return "running";
  if (normalized === "success") return "success";
  if (normalized === "fail") return "fail";
  return null;
};

export const isLegalGenerationTransition = ({
  from,
  to,
}: {
  from: GenerationLifecycleState;
  to: GenerationLifecycleState;
}): boolean => {
  if (from === to) return true;
  return LEGAL_TRANSITIONS[from].has(to);
};

export const resolveTransitionErrorCode = ({
  from,
  to,
}: {
  from: GenerationLifecycleState;
  to: GenerationLifecycleState;
}): "state_transition_invalid" | null => {
  if (isLegalGenerationTransition({ from, to })) return null;
  return "state_transition_invalid";
};
