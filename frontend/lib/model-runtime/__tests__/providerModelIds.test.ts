/**
 * Unit coverage for canonical provider model-id constants.
 */

import { describe, expect, it } from "vitest";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SUPPORTED_MODEL_IDS,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  isKnownKieModelId,
} from "../providerModelIds";

describe("providerModelIds", () => {
  it("exposes canonical kie model ids", () => {
    expect(KIE_VEO_31_FAST_I2V_MODEL_ID).toBe("kie-ai/veo-3.1-fast-i2v");
    expect(KIE_KLING_30_MODEL_ID).toBe("kie-ai/kling-3.0");
    expect(KIE_SUPPORTED_MODEL_IDS).toEqual(["kie-ai/veo-3.1-fast-i2v", "kie-ai/kling-3.0"]);
  });

  it("matches known and unknown kie model ids deterministically", () => {
    expect(isKnownKieModelId(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(isKnownKieModelId(KIE_KLING_30_MODEL_ID)).toBe(true);
    expect(isKnownKieModelId("kie-ai/unknown")).toBe(false);
  });
});
