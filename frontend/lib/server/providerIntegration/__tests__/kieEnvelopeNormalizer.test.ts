/**
 * Unit coverage for Kie envelope normalization.
 */

import { describe, expect, it } from "vitest";
import { normalizeKieEnvelopePayload } from "../kieEnvelopeNormalizer";

describe("kieEnvelopeNormalizer", () => {
  it("normalizes nested envelope status/response url and sanitizes malformed top-level fields", () => {
    const normalized = normalizeKieEnvelopePayload({
      status: { malformed: true },
      response_url: { malformed: true },
      data: {
        result: {
          status: "success",
          responseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1",
          resultUrls: ["https://cdn.shortpulse.test/kie-result.mp4"],
        },
      },
    });

    expect(normalized.status).toBe("success");
    expect(normalized.state).toBe("success");
    expect(normalized.response_url).toBe("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1");
    expect(normalized.responseUrl).toBe("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_1");
    expect(normalized.resultUrls).toEqual(["https://cdn.shortpulse.test/kie-result.mp4"]);
    expect(normalized.result_urls).toEqual(["https://cdn.shortpulse.test/kie-result.mp4"]);
  });

  it("parses object or string resultJson payloads into canonical object shape", () => {
    const fromObject = normalizeKieEnvelopePayload({
      data: {
        resultJson: {
          resultUrls: ["https://cdn.shortpulse.test/from-object.mp4"],
        },
      },
    });
    const fromString = normalizeKieEnvelopePayload({
      result: {
        resultJson: '{"resultUrls":["https://cdn.shortpulse.test/from-string.mp4"]}',
      },
    });

    expect(fromObject.resultJson).toEqual({
      resultUrls: ["https://cdn.shortpulse.test/from-object.mp4"],
    });
    expect(fromString.resultJson).toEqual({
      resultUrls: ["https://cdn.shortpulse.test/from-string.mp4"],
    });
  });

  it("normalizes veo record-info successFlag and data.response.resultUrls", () => {
    const normalized = normalizeKieEnvelopePayload({
      code: 200,
      msg: "success",
      data: {
        taskId: "veo_task_abcdef123456",
        successFlag: 1,
        response: {
          resultUrls: ["https://cdn.shortpulse.test/veo-response-result.mp4"],
        },
      },
    });

    expect(normalized.successFlag).toBe(1);
    expect(normalized.success_flag).toBe(1);
    expect(normalized.response).toEqual({
      resultUrls: ["https://cdn.shortpulse.test/veo-response-result.mp4"],
    });
    expect(normalized.resultUrls).toEqual(["https://cdn.shortpulse.test/veo-response-result.mp4"]);
    expect(normalized.result_urls).toEqual(["https://cdn.shortpulse.test/veo-response-result.mp4"]);
  });

  it("normalizes resultUrl object arrays with camelCase URL fields", () => {
    const normalized = normalizeKieEnvelopePayload({
      code: 200,
      data: {
        state: "success",
        resultUrls: [{ imageUrl: "https://cdn.shortpulse.test/kie-image-result.png" }],
      },
    });

    expect(normalized.resultUrls).toEqual(["https://cdn.shortpulse.test/kie-image-result.png"]);
    expect(normalized.result_urls).toEqual(["https://cdn.shortpulse.test/kie-image-result.png"]);
  });
});
