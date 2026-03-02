/**
 * Safety policy decision engine with modality + environment-aware resolution.
 */
import { mapClassificationToSafetyCategory } from "./categoryCatalog";
import { applyHardFloorOverride } from "./hardFloors";
import { resolveSafetyProfile } from "./profileCatalog";
import type {
  SafetyClassification,
  SafetyDecision,
  SafetyEnvironment,
  SafetyModality,
} from "./types";

export const resolveSafetyEnvironment = (nodeEnv?: string | null): SafetyEnvironment =>
  nodeEnv === "production" ? "production" : "development";

export const resolveSafetyModality = ({
  route,
  flow,
}: {
  route: "studio-agent" | "describe-image";
  flow?: string;
}): SafetyModality => {
  if (route === "describe-image") return "image";
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
}: {
  classification: SafetyClassification;
  modality: SafetyModality;
  environment: SafetyEnvironment;
  profileId?: string | null;
  devAbsoluteZeroEnabled?: boolean;
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

  const profileAction = resolvedProfile.profile[modality][category];
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
