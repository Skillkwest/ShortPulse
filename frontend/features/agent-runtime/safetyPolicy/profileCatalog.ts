/**
 * Active safety profile catalog for modality-aware decision evaluation.
 */
import type {
  ModalitySafetyProfile,
  SafetyFamily,
  SafetyPolicyAction,
  SafetyProfileId,
  SafetyTextLevel,
} from "./types";

const levelToActions = (
  level: SafetyTextLevel
): Record<`${SafetyFamily}_${"suggestive" | "explicit"}`, SafetyPolicyAction> => {
  if (level === "allow") {
    return {
      sexual_suggestive: "allow",
      sexual_explicit: "allow",
      violence_suggestive: "allow",
      violence_explicit: "allow",
      self_harm_suggestive: "allow",
      self_harm_explicit: "allow",
      hate_suggestive: "allow",
      hate_explicit: "allow",
    };
  }
  if (level === "rewrite") {
    return {
      sexual_suggestive: "rewrite",
      sexual_explicit: "rewrite",
      violence_suggestive: "rewrite",
      violence_explicit: "rewrite",
      self_harm_suggestive: "rewrite",
      self_harm_explicit: "rewrite",
      hate_suggestive: "rewrite",
      hate_explicit: "rewrite",
    };
  }
  return {
    sexual_suggestive: "rewrite",
    sexual_explicit: "refuse",
    violence_suggestive: "rewrite",
    violence_explicit: "refuse",
    self_harm_suggestive: "rewrite",
    self_harm_explicit: "refuse",
    hate_suggestive: "rewrite",
    hate_explicit: "refuse",
  };
};

const buildUniformProfile = (level: SafetyTextLevel): ModalitySafetyProfile => {
  const familyActions = levelToActions(level);
  const actions = {
    safe: "allow" as const,
    ...familyActions,
  };
  return {
    text: actions,
    image: actions,
    video: actions,
  };
};

const PROFILE_CATALOG: Record<SafetyProfileId, ModalitySafetyProfile> = {
  prod_safe_v1: buildUniformProfile("refuse"),
  staging_lenient: buildUniformProfile("rewrite"),
  dev_absolute_zero: buildUniformProfile("allow"),
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
