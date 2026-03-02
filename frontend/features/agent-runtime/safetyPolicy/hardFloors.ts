/**
 * Immutable production hard-floor overrides.
 */
import type { SafetyCategoryId, SafetyEnvironment, SafetyPolicyAction } from "./types";

const PRODUCTION_HARD_FLOOR_CATEGORIES = new Set<SafetyCategoryId>(["sexual_explicit"]);

export const isHardFloorCategory = ({
  category,
  environment,
}: {
  category: SafetyCategoryId;
  environment: SafetyEnvironment;
}): boolean => environment === "production" && PRODUCTION_HARD_FLOOR_CATEGORIES.has(category);

export const applyHardFloorOverride = ({
  action,
  category,
  environment,
}: {
  action: SafetyPolicyAction;
  category: SafetyCategoryId;
  environment: SafetyEnvironment;
}): { action: SafetyPolicyAction; source: "profile" | "hard_floor" } => {
  if (isHardFloorCategory({ category, environment })) {
    return { action: "refuse", source: "hard_floor" };
  }
  return { action, source: "profile" };
};
