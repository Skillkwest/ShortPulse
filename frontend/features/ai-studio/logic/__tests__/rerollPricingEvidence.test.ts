import { describe, expect, it } from "vitest";

import { KIE_KLING_30_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { buildDefaultPricingParams } from "../../../../lib/model-runtime/pricing";
import {
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../../../lib/model-runtime/pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../../../../lib/model-runtime/materializeImageBilledCreditPolicy";
import { resolveVideoBilledCreditLookup } from "../../../../lib/model-runtime/videoBilledCredits";
import type { WorkflowReloadConfigV1 } from "../../types";
import { resolveRerollPricingEvidence } from "../rerollPricingEvidence";

const basePolicy: ModelPricingPolicyDocument = {
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
};

const pricingPolicy = materializeImageBilledCreditPolicy(basePolicy);

const baseConfig = {
  version: 1,
  source: "ai_studio_generation",
  capturedAt: "2026-07-10T17:00:00.000Z",
  restoreBehavior: "navigate_and_hydrate",
  projectId: null,
  createMode: "standard",
  pulse: null,
  prompt: {
    display: "Visible prompt",
    submission: "Submission prompt",
  },
} satisfies Pick<
  WorkflowReloadConfigV1,
  | "version"
  | "source"
  | "capturedAt"
  | "restoreBehavior"
  | "projectId"
  | "createMode"
  | "pulse"
  | "prompt"
>;

describe("resolveRerollPricingEvidence", () => {
  it("resolves active-policy create-image evidence from replay payload settings", () => {
    const config: WorkflowReloadConfigV1 = {
      ...baseConfig,
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      model: { id: "fal-ai/nano-banana-2" },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "16:9",
        imageResolution: "1K",
        referenceInputs: ["https://cdn.shortpulse.test/ref-a.png"],
        internalMediaRefs: [],
      },
    };

    expect(
      resolveRerollPricingEvidence({
        config,
        pricingPolicy,
        activePricingPolicyVersion: 23,
      })
    ).toEqual({
      displayedBilledCredits: 5,
      displayedPricingPolicyVersion: 23,
      displayedPricingVariantId: "default|res:1K|aspect:auto",
    });
  });

  it("resolves active-policy video evidence from replay payload settings", () => {
    const config: WorkflowReloadConfigV1 = {
      ...baseConfig,
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      model: { id: KIE_KLING_30_MODEL_ID },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "standard",
        durationSeconds: 6,
        resolution: "1080p",
        generateAudio: false,
        cameraFixed: false,
        autoFix: true,
        referenceInputs: [],
        internalMediaRefs: [],
        seedance2ReferenceImageUrls: [],
        seedance2ReferenceVideoUrls: [],
        seedance2ReferenceAudioUrls: [],
        seedance2ReturnLastFrame: false,
        seedance2WebSearch: false,
        klingElements: [],
      },
    };
    const expectedBreakdown = resolveVideoBilledCreditLookup({
      modelId: KIE_KLING_30_MODEL_ID,
      params: buildDefaultPricingParams(KIE_KLING_30_MODEL_ID, {
        aspect: "16:9",
        durationSeconds: 6,
        resolution: "1080p",
        audio: false,
      }),
      pricingPolicy,
    }).breakdown;

    expect(
      resolveRerollPricingEvidence({
        config,
        pricingPolicy,
        activePricingPolicyVersion: 23,
      })
    ).toEqual({
      displayedBilledCredits: expectedBreakdown?.credits,
      displayedPricingPolicyVersion: 23,
      displayedPricingVariantId: expectedBreakdown?.variantId,
    });
  });
});
