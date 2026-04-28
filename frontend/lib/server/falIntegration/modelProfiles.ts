/**
 * Fal model profiles define submit and retrieval aliases per model.
 * Keep this registry as the single source of model-specific endpoint quirks.
 */

import { listModelCatalogEntries } from "../../model-runtime/modelCatalog";
import type { SubmitTarget } from "./contracts";

export type FalModelProfile = {
  profileId: string;
  modelId: string;
  submitTargets: SubmitTarget[];
  statusBases: string[];
  timeoutMs: number;
};

const defaultFalProfilesByModelId: Record<string, FalModelProfile> = Object.fromEntries(
  listModelCatalogEntries()
    .filter((entry) => entry.provider === "fal" && entry.falStatusBaseUrls?.length)
    .map((entry) => [
      entry.modelId,
      {
        profileId: entry.modelId,
        modelId: entry.modelId,
        submitTargets: entry.falSubmitUrl ? [{ submitUrl: entry.falSubmitUrl }] : [],
        statusBases: entry.falStatusBaseUrls ?? [],
        timeoutMs: entry.falTimeoutMs ?? 60000,
      } satisfies FalModelProfile,
    ])
);

export const falModelProfilesByModelId: Record<string, FalModelProfile> = {
  ...defaultFalProfilesByModelId,
};

export const getFalModelProfileByModelId = (modelId: string): FalModelProfile | null =>
  falModelProfilesByModelId[modelId] ?? null;

export const falModelProfiles: Record<string, FalModelProfile> = {};
