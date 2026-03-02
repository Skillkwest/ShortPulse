/**
 * Active safety profile catalog for modality-aware decision evaluation.
 */
import type { ModalitySafetyProfile, SafetyPolicyAction, SafetyProfileId } from "./types";

const buildUniformProfile = (
  actions: Record<"safe" | "sexual_suggestive" | "sexual_explicit", SafetyPolicyAction>
): ModalitySafetyProfile => ({
  text: actions,
  image: actions,
  video: actions,
});

const PROFILE_CATALOG: Record<SafetyProfileId, ModalitySafetyProfile> = {
  prod_safe_v1: buildUniformProfile({
    safe: "allow",
    sexual_suggestive: "rewrite",
    sexual_explicit: "refuse",
  }),
  staging_lenient: buildUniformProfile({
    safe: "allow",
    sexual_suggestive: "rewrite",
    sexual_explicit: "rewrite",
  }),
  dev_absolute_zero: buildUniformProfile({
    safe: "allow",
    sexual_suggestive: "allow",
    sexual_explicit: "allow",
  }),
};

const FALLBACK_PROFILE_ID: SafetyProfileId = "prod_safe_v1";

export const resolveSafetyProfileId = (rawProfileId?: string | null): SafetyProfileId => {
  const normalized = String(rawProfileId ?? "")
    .trim()
    .toLowerCase();
  if (normalized === "staging_lenient") return "staging_lenient";
  if (normalized === "dev_absolute_zero") return "dev_absolute_zero";
  return FALLBACK_PROFILE_ID;
};

export const resolveSafetyProfile = (
  rawProfileId?: string | null
): {
  profileId: SafetyProfileId;
  profile: ModalitySafetyProfile;
} => {
  const profileId = resolveSafetyProfileId(rawProfileId);
  return { profileId, profile: PROFILE_CATALOG[profileId] };
};
