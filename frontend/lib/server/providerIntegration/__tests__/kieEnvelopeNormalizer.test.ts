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
});
