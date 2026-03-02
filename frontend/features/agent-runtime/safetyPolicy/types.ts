/**
 * Safety policy domain types for modality-aware runtime decisions.
 */

export type SafetyModality = "text" | "image" | "video";

export type SafetyPolicyAction = "allow" | "rewrite" | "refuse";

export type SafetyCategoryId = "safe" | "sexual_suggestive" | "sexual_explicit";

export type SafetyProfileId = "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero";

export type SafetyEnvironment = "development" | "production";

export type SafetyClassification = "safe" | "needs_rewrite" | "refuse";

export type ModalitySafetyProfile = Record<
  SafetyModality,
  Record<SafetyCategoryId, SafetyPolicyAction>
>;

export type SafetyDecision = {
  action: SafetyPolicyAction;
  source: "profile" | "hard_floor" | "absolute_zero";
  profileId: SafetyProfileId;
  category: SafetyCategoryId;
  modality: SafetyModality;
};
