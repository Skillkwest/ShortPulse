/**
 * Shared server resolution for AI Studio agent safety policy and runtime flags.
 * Keeps Standard and Pulse on one control-plane interpretation without merging routes.
 */
import {
  resolveRuntimeSafetyProfile,
  type RuntimeSafetyProfileResolution,
} from "../../lib/server/api/agentSafetyPolicyControlPlane";
import { resolveSafetyEnvironment } from "./safetyPolicy/decisionEngine";
import { resolveSafetyPolicyDocument } from "./safetyPolicy/policyDocument";
import {
  resolveProviderErrorNormalizationMode,
  type ProviderErrorNormalizationMode,
} from "./safetyPolicy/providerErrorPolicy";
import type {
  SafetyEnvironment,
  SafetyPolicyDocumentV2,
  SafetyPostprocessMode,
} from "./safetyPolicy/types";
import { isSafeCompletionEnabled } from "./studioAgentSafeCompletion";

export type StudioAgentSafetyRuntimeConfig = {
  inputPrecheckEnabled: boolean;
  debugEnabled: boolean;
  profile: RuntimeSafetyProfileResolution;
  profileId: RuntimeSafetyProfileResolution["profileId"];
  policyDocument: SafetyPolicyDocumentV2;
  policySchemaVersion: number;
  environment: SafetyEnvironment;
  devAbsoluteZeroEnabled: boolean;
  postProcessMode: SafetyPostprocessMode;
  providerErrorMode: ProviderErrorNormalizationMode;
  autoRollbackEnabled: boolean;
  safeCompletionEnabled: boolean;
};

/** Resolves the complete safety runtime configuration for one server turn. */
export const resolveStudioAgentSafetyRuntimeConfig = async (
  env: NodeJS.ProcessEnv = process.env
): Promise<StudioAgentSafetyRuntimeConfig> => {
  const profile = await resolveRuntimeSafetyProfile({
    envProfileId: env.STUDIO_AGENT_SAFETY_PROFILE_ACTIVE ?? null,
    runtimeControlPlaneSyncEnabled: env.STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED,
    controlPlaneCacheTtlMs: env.STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS,
  });
  const policyDocument = resolveSafetyPolicyDocument({
    activePolicy: profile.activePolicy,
    profileId: profile.profileId,
  });
  const configuredPostprocessMode = String(env.STUDIO_AGENT_SAFETY_POSTPROCESS_MODE ?? "")
    .trim()
    .toLowerCase();
  const postProcessMode: SafetyPostprocessMode =
    configuredPostprocessMode === "enforce" || configuredPostprocessMode === "off"
      ? configuredPostprocessMode
      : env.STUDIO_AGENT_SAFETY_POSTPROCESS_ENABLED === "false"
        ? "off"
        : policyDocument.postprocess.mode;

  return {
    inputPrecheckEnabled: env.STUDIO_AGENT_SAFETY_INPUT_PRECHECK_ENABLED !== "false",
    debugEnabled: env.STUDIO_AGENT_SAFETY_DEBUG === "true",
    profile,
    profileId: profile.profileId,
    policyDocument,
    policySchemaVersion: policyDocument.schemaVersion,
    environment: resolveSafetyEnvironment(env.NODE_ENV),
    devAbsoluteZeroEnabled: env.STUDIO_AGENT_SAFETY_DEV_ABSOLUTE_ZERO_ENABLED === "true",
    postProcessMode,
    providerErrorMode: resolveProviderErrorNormalizationMode(
      env.STUDIO_AGENT_SAFETY_PROVIDER_ERROR_MODE
    ),
    autoRollbackEnabled: env.STUDIO_AGENT_SAFETY_AUTOROLLBACK_ENABLED === "true",
    safeCompletionEnabled: isSafeCompletionEnabled(env),
  };
};
