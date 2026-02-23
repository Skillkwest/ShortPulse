/**
 * Provider API contract manifest for AI Studio models.
 * Centralizes aspect/resolution/duration capabilities verified against model docs.
 */

import {
  listModelCatalogEntries,
  type ModelAspectSubmitField,
} from "../../../lib/model-runtime/modelCatalog";

export type { ModelAspectSubmitField };

export type ModelApiContract = {
  modelId: string;
  defaultAspect: string;
  allowedAspects: string[];
  defaultResolution?: string;
  allowedResolutions?: string[];
  defaultDurationSeconds?: number;
  allowedDurations?: number[];
  submitAspectField: ModelAspectSubmitField;
  sourceUrl: string;
  verifiedAt: string;
};

const contracts: Record<string, ModelApiContract> = Object.fromEntries(
  listModelCatalogEntries().map((entry) => [
    entry.modelId,
    {
      modelId: entry.modelId,
      defaultAspect: entry.defaultAspect,
      allowedAspects: entry.allowedAspects,
      defaultResolution: entry.defaultResolution,
      allowedResolutions: entry.allowedResolutions,
      defaultDurationSeconds: entry.defaultDurationSeconds,
      allowedDurations: entry.allowedDurations,
      submitAspectField: entry.submitAspectField,
      sourceUrl: entry.sourceUrl,
      verifiedAt: entry.verifiedAt,
    },
  ])
);

export const listModelApiContracts = (): ModelApiContract[] => Object.values(contracts);

export const getModelApiContract = (modelId: string): ModelApiContract | null =>
  contracts[modelId] ?? null;

export const getModelAllowedAspects = (modelId: string, fallback: string[] = []): string[] => {
  const contract = getModelApiContract(modelId);
  return contract?.allowedAspects?.length ? contract.allowedAspects : fallback;
};

export const getModelDefaultAspect = (modelId: string, fallback: string): string => {
  return getModelApiContract(modelId)?.defaultAspect ?? fallback;
};

export const getModelAllowedResolutions = (
  modelId: string,
  fallback: string[] | undefined
): string[] | undefined => {
  const contract = getModelApiContract(modelId);
  if (contract?.allowedResolutions) return contract.allowedResolutions;
  return fallback;
};

export const getModelDefaultResolution = (
  modelId: string,
  fallback: string | undefined
): string | undefined => {
  const contract = getModelApiContract(modelId);
  if (typeof contract?.defaultResolution === "string") return contract.defaultResolution;
  return fallback;
};

export const getModelAllowedDurations = (
  modelId: string,
  fallback: number[] | undefined
): number[] | undefined => {
  const contract = getModelApiContract(modelId);
  if (contract?.allowedDurations) return contract.allowedDurations;
  return fallback;
};

export const getModelDefaultDurationSeconds = (
  modelId: string,
  fallback: number | undefined
): number | undefined => {
  const contract = getModelApiContract(modelId);
  if (typeof contract?.defaultDurationSeconds === "number") return contract.defaultDurationSeconds;
  return fallback;
};

export const resolveEffectiveAspectForModel = (
  modelId: string,
  requestedAspect: string | null | undefined,
  fallback = "16:9"
): string => {
  const contract = getModelApiContract(modelId);
  const next = requestedAspect?.trim();

  if (!contract) {
    return next && next.length ? next : fallback;
  }

  if (!contract.allowedAspects.length) {
    return next && next.length ? next : contract.defaultAspect;
  }

  if (next && contract.allowedAspects.includes(next)) {
    return next;
  }

  if (contract.allowedAspects.includes(contract.defaultAspect)) {
    return contract.defaultAspect;
  }

  return contract.allowedAspects[0] ?? fallback;
};
