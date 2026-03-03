/**
 * Internal policy for post-rewrite recheck behavior in input precheck flows.
 */
import type { SafetyCategoryId, SafetyPolicyAction } from "./types";

export type SafetyRewriteRecheckMode = "allow_only" | "allow_or_rewrite";

export const DEFAULT_SAFETY_REWRITE_RECHECK_MODE: SafetyRewriteRecheckMode = "allow_only";

const ALLOW_OR_REWRITE_CATEGORY_ALLOWLIST = new Set<SafetyCategoryId>([
  "sexual_suggestive",
  "violence_suggestive",
]);

/**
 * Determines whether a rewritten payload should be blocked after reevaluation.
 */
export const shouldBlockAfterRewrite = ({
  mode,
  action,
  category,
}: {
  mode: SafetyRewriteRecheckMode;
  action: SafetyPolicyAction;
  category: SafetyCategoryId;
}): boolean => {
  if (mode === "allow_or_rewrite") {
    if (action === "rewrite") {
      return !ALLOW_OR_REWRITE_CATEGORY_ALLOWLIST.has(category);
    }
    return action === "refuse";
  }
  return action !== "allow";
};
