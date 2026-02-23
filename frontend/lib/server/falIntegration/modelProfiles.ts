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

const veoImageToVideoProfile: FalModelProfile = {
  profileId: "veo-image-to-video",
  modelId: "fal-ai/veo3.1/image-to-video",
  submitTargets: [
    {
      submitUrl: "https://queue.fal.run/fal-ai/veo3.1/image-to-video",
      transformPayload: (payload) => {
        const firstImageUrl = Array.isArray(payload.image_urls)
          ? payload.image_urls[0]
          : typeof payload.image_urls === "string"
            ? payload.image_urls
            : payload.image_url;
        return {
          ...payload,
          image_url: firstImageUrl,
        };
      },
    },
    {
      submitUrl: "https://queue.fal.run/fal-ai/veo3.1/reference-to-video",
      transformPayload: (payload) => {
        const firstImageUrl = Array.isArray(payload.image_urls)
          ? payload.image_urls[0]
          : typeof payload.image_urls === "string"
            ? payload.image_urls
            : payload.image_url;
        const imageUrls = Array.isArray(payload.image_urls)
          ? payload.image_urls
          : firstImageUrl
            ? [firstImageUrl]
            : [];
        return {
          ...payload,
          image_urls: imageUrls.length ? imageUrls : undefined,
        };
      },
    },
  ],
  statusBases: [
    "https://queue.fal.run/fal-ai/veo3.1/requests",
    "https://queue.fal.run/fal-ai/veo3.1/image-to-video/requests",
    "https://queue.fal.run/fal-ai/veo3.1/reference-to-video/requests",
  ],
  timeoutMs: 90000,
};

export const falModelProfilesByModelId: Record<string, FalModelProfile> = {
  ...defaultFalProfilesByModelId,
  [veoImageToVideoProfile.modelId]: veoImageToVideoProfile,
};

export const getFalModelProfileByModelId = (modelId: string): FalModelProfile | null =>
  falModelProfilesByModelId[modelId] ?? null;

export const falModelProfiles: Record<string, FalModelProfile> = {
  veoImageToVideo: veoImageToVideoProfile,
};
