/**
 * Safety policy decision engine with modality + environment-aware resolution.
 */
import { mapClassificationToSafetyCategory, SAFETY_CATEGORY_CATALOG } from "./categoryCatalog";
import { applyHardFloorOverride } from "./hardFloors";
import { resolvePolicyTextAction } from "./policyDocument";
import { resolveSafetyProfile } from "./profileCatalog";
import type {
  SafetyClassification,
  SafetyDecision,
  SafetyEnvironment,
  SafetyModality,
  SafetyPolicyDocumentV2,
  SafetyPolicyAction,
} from "./types";

export const resolveSafetyEnvironment = (nodeEnv?: string | null): SafetyEnvironment =>
  nodeEnv === "production" ? "production" : "development";

export const resolveSafetyModality = ({
  flow,
}: {
  route: "studio-agent" | "studio-agent-pulse";
  flow?: string;
}): SafetyModality => {
  if (flow === "IMAGE_ONLY" || flow === "MIXED") return "image";
  if (flow?.includes("VIDEO")) return "video";
  return "text";
};

export const resolveSafetyDecision = ({
  classification,
  modality,
  environment,
  profileId,
  devAbsoluteZeroEnabled = false,
  policyDocument,
}: {
  classification: SafetyClassification;
  modality: SafetyModality;
  environment: SafetyEnvironment;
  profileId?: string | null;
  devAbsoluteZeroEnabled?: boolean;
  policyDocument?: SafetyPolicyDocumentV2 | null;
}): SafetyDecision => {
  const category = mapClassificationToSafetyCategory(classification);
  const resolvedProfile = resolveSafetyProfile(profileId);
  if (devAbsoluteZeroEnabled && environment !== "production") {
    return {
      action: "allow",
      source: "absolute_zero",
      profileId: resolvedProfile.profileId,
      category,
      modality,
    };
  }

  let profileAction: SafetyPolicyAction = resolvedProfile.profile[modality][category];
  const categoryMeta = SAFETY_CATEGORY_CATALOG[category];
  if (policyDocument && categoryMeta.family && categoryMeta.severity) {
    profileAction = resolvePolicyTextAction({
      policy: policyDocument,
      modality,
      family: categoryMeta.family,
      severity: categoryMeta.severity,
    });
  }
  const withHardFloor = applyHardFloorOverride({
    action: profileAction,
    category,
    environment,
  });
  return {
    action: withHardFloor.action,
    source: withHardFloor.source,
    profileId: resolvedProfile.profileId,
    category,
    modality,
  };
};
