/**
 * Unit coverage for Kie model-aware result media extraction contracts.
 */

import { describe, expect, it } from "vitest";
import {
  extractKieResultMediaUrls,
  isSupportedKieResultMediaModel,
} from "../kieResultMediaContracts";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../kieModelIds";
import {
  kieKlingCallbackSuccessFixture,
  kieKlingRecordInfoSuccessFixture,
  kieVeoRecordInfoSuccessFixture,
} from "./fixtures/kieContractFixtures";

describe("kieResultMediaContracts", () => {
  it("tracks supported Kie media models", () => {
    expect(isSupportedKieResultMediaModel(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe(true);
    expect(isSupportedKieResultMediaModel(KIE_KLING_30_MODEL_ID)).toBe(true);
    expect(isSupportedKieResultMediaModel("kie-ai/unknown")).toBe(false);
  });

  it("extracts media URLs for active Kie Seedance 2 payloads", () => {
    const standardUrls = extractKieResultMediaUrls({
      modelId: KIE_SEEDANCE_2_MODEL_ID,
      payload: {
        data: {
          response: {
            resultUrls: ["https://cdn.shortpulse.test/seedance-2-result.mp4"],
          },
        },
      },
    });
    const fastUrls = extractKieResultMediaUrls({
      modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
      payload: {
        data: {
          resultJson: '{"resultUrls":["https://cdn.shortpulse.test/seedance-2-fast-result.mp4"]}',
        },
      },
    });

    expect(standardUrls).toEqual(["https://cdn.shortpulse.test/seedance-2-result.mp4"]);
    expect(fastUrls).toEqual(["https://cdn.shortpulse.test/seedance-2-fast-result.mp4"]);
  });

  it("extracts model-aware media URLs for Kie VEO i2v payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      payload: {
        result: {
          videos: [{ url: "https://cdn.shortpulse.test/veo.mp4" }],
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/veo.mp4"]);
  });

  it("extracts model-aware media URLs for Kie Kling payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: {
        output: {
          outputs: [{ download_url: "https://cdn.shortpulse.test/kling.mp4" }],
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kling.mp4"]);
  });

  it("extracts media URLs from callback-style resultJson payloads", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: {
        data: {
          resultJson: JSON.stringify({
            resultUrls: ["https://cdn.shortpulse.test/kling-callback.mp4"],
          }),
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kling-callback.mp4"]);
  });

  it("extracts media URLs from primary-source callback fixture resultJson", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: kieKlingCallbackSuccessFixture,
    });
    expect(urls).toEqual(["https://example.com/generated-video.mp4"]);
  });

  it("extracts media URLs from record-info style envelopes", () => {
    const veoUrls = extractKieResultMediaUrls({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      payload: kieVeoRecordInfoSuccessFixture,
    });
    const klingUrls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: kieKlingRecordInfoSuccessFixture,
    });
    expect(veoUrls).toEqual(["https://example.com/veo-generated-video.mp4"]);
    expect(klingUrls).toEqual(["https://example.com/generated-video-from-record-info.mp4"]);
  });

  it("extracts veo media URLs from data.response.resultUrls envelope shape", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      payload: {
        data: {
          successFlag: 1,
          response: {
            resultUrls: ["https://cdn.shortpulse.test/veo-response-nested.mp4"],
          },
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/veo-response-nested.mp4"]);
  });

  it("extracts veo media URLs from data.response.originUrls envelope shape", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
      payload: {
        data: {
          successFlag: 1,
          response: {
            originUrls: ["https://cdn.shortpulse.test/veo-origin-nested.mp4"],
          },
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/veo-origin-nested.mp4"]);
  });

  it("extracts media URLs when resultJson is already a parsed object", () => {
    const urls = extractKieResultMediaUrls({
      modelId: KIE_KLING_30_MODEL_ID,
      payload: {
        data: {
          result: {
            resultJson: {
              resultUrls: ["https://cdn.shortpulse.test/kling-result-object.mp4"],
            },
          },
        },
      },
    });
    expect(urls).toEqual(["https://cdn.shortpulse.test/kling-result-object.mp4"]);
  });

  it("fails closed to empty list for unsupported models", () => {
    const urls = extractKieResultMediaUrls({
      modelId: "kie-ai/unknown",
      payload: {
        videos: [{ url: "https://cdn.shortpulse.test/unknown.mp4" }],
      },
    });
    expect(urls).toEqual([]);
  });
});
