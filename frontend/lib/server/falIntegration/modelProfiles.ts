/**
 * Fal model profiles define submit and retrieval aliases per model.
 * Keep this registry as the single source of model-specific endpoint quirks.
 */

import type { SubmitTarget } from "./contracts";

export type FalModelProfile = {
  profileId: string;
  modelId: string;
  submitTargets: SubmitTarget[];
  statusBases: string[];
  timeoutMs: number;
};

export const falModelProfiles: Record<string, FalModelProfile> = {
  veoImageToVideo: {
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
  },
};
