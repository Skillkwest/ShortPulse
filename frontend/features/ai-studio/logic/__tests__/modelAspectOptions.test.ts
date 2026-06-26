import { describe, expect, it } from "vitest";

import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import { resolveUiAllowedAspectsForModel } from "../modelAspectOptions";

const gptImage2Aspects = ["auto", "9:16", "4:5", "1:1", "5:4", "16:9"];

describe("modelAspectOptions", () => {
  it("hides 4:5 and 5:4 for Kie GPT Image 2 text and edit models", () => {
    expect(
      resolveUiAllowedAspectsForModel({
        modelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
        allowedAspects: gptImage2Aspects,
      })
    ).toEqual(["auto", "9:16", "1:1", "16:9"]);

    expect(
      resolveUiAllowedAspectsForModel({
        modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        allowedAspects: gptImage2Aspects,
      })
    ).toEqual(["auto", "9:16", "1:1", "16:9"]);
  });

  it("leaves non-GPT Image 2 aspect options unchanged", () => {
    expect(
      resolveUiAllowedAspectsForModel({
        modelId: "fal-ai/example",
        allowedAspects: gptImage2Aspects,
      })
    ).toEqual(gptImage2Aspects);
  });
});
