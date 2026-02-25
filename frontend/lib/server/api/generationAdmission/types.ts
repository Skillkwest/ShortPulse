/**
 * Types for generation admission evaluation and enforcement.
 * Keeps submit-time concurrency contracts explicit and testable.
 */
import type { GenerationAdmissionTier } from "../../../model-runtime/generationAdmissionTiers";

export type GenerationAdmissionMode = "off" | "shadow" | "enforce";

export type GenerationAdmissionReason =
  | "global_limit"
  | "tier_limit"
  | "global_and_tier_limit"
  | null;

export type GenerationAdmissionTierLimits = Record<GenerationAdmissionTier, number>;

export type GenerationAdmissionConfig = {
  mode: GenerationAdmissionMode;
  globalMax: number;
  tierLimits: GenerationAdmissionTierLimits;
  retryAfterSeconds: number;
};

export type GenerationAdmissionSnapshot = {
  globalActive: number;
  globalMax: number;
  tier: GenerationAdmissionTier;
  tierActive: number;
  tierMax: number;
};

export type GenerationAdmissionDecision = {
  mode: GenerationAdmissionMode;
  allowed: boolean;
  enforced: boolean;
  wouldLimit: boolean;
  reason: GenerationAdmissionReason;
  retryAfterSeconds: number;
  snapshot: GenerationAdmissionSnapshot;
};
