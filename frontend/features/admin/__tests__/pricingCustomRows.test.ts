import { describe, expect, it } from "vitest";

import { getDefaultAdminPricingCustomRowsDocument } from "../../../lib/model-runtime/adminPricingCustomRows";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../../../lib/model-runtime/falModelIds";
import { getDefaultModelPricingPolicyDocument } from "../../../lib/model-runtime/pricingPolicy";
import { buildMergedPricingPreviewVariants } from "../pricingCustomRows";
import type { AdminPricingModelRow } from "../types";

const buildFlux2KleinPricingModel = (): AdminPricingModelRow =>
  ({
    id: FAL_FLUX_2_KLEIN_9B_MODEL_ID,
    label: "FLUX.2 Lite",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    workflowType: "Text to image",
    pricingStrategy: "fal-economy-image-per-mp",
    pricingStrategyLabel: "fal-economy-image-per-mp",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    defaultDurationSeconds: null,
    defaultSourceDurationSeconds: null,
    minDurationSeconds: null,
    maxDurationSeconds: null,
    allowedDurations: [],
    defaultAudio: null,
    roundingIncrement: 1,
    pricingAuthority: "shared_policy",
    pricingPreview: null,
    pricingPreviewVariants: [
      {
        id: "default",
        label: "Default",
        breakdown: {
          usdRaw: 0.00648,
          rawCredits: 1,
          billedCredits: 2,
          billedUsd: 0.02,
        },
      },
    ],
  }) as AdminPricingModelRow;

describe("pricingCustomRows", () => {
  it("merges built-in Flux2 Klein semantic rows into the admin pricing grid variants", () => {
    const rows = buildMergedPricingPreviewVariants({
      model: buildFlux2KleinPricingModel(),
      pricingPolicy: getDefaultModelPricingPolicyDocument(),
      customRowsDocument: getDefaultAdminPricingCustomRowsDocument(),
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          displayRowId: "builtin:flux-2-klein-audio-companion-art",
          isCustomRow: true,
          customRow: expect.objectContaining({
            label: "Audio reference background",
          }),
          variant: expect.objectContaining({
            id: `${FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
            label: "Audio reference background",
            aspect: "1:1",
            resolution: "model_default",
          }),
        }),
        expect.objectContaining({
          displayRowId: "builtin:flux-2-klein-style-preview",
          isCustomRow: true,
          customRow: expect.objectContaining({
            label: "Style placeholder preview",
          }),
          variant: expect.objectContaining({
            id: `${FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID}|res:model_default|aspect:1:1`,
            label: "Style placeholder preview",
            aspect: "1:1",
            resolution: "model_default",
          }),
        }),
      ])
    );
  });
});
