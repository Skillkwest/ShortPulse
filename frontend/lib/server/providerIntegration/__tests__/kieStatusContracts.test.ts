/**
 * Unit coverage for Kie status/result contract helpers.
 */

import { describe, expect, it } from "vitest";
import {
  isKieCompletedStatus,
  isKieRetryableUpstreamPayload,
  isKieFailedStatus,
  isKieRetryableUpstreamResponse,
  kiePayloadHasMedia,
  readKieContentPolicyMessage,
  readKieLifecycleStatus,
  readKieResponseUrl,
  resolveKieSuccessfulPayloadStatus,
  validateKieStatusPayloadForModel,
} from "../kieStatusContracts";
import {
  kieKlingCallbackFailureFixture,
  kieKlingCallbackSuccessFixture,
} from "./fixtures/kieContractFixtures";

describe("kieStatusContracts", () => {
  it("normalizes lifecycle status aliases from Kie payloads", () => {
    expect(readKieLifecycleStatus({ state: "in_progress" })).toBe("running");
    expect(readKieLifecycleStatus({ status: "processing" })).toBe("running");
    expect(readKieLifecycleStatus({ status: "done" })).toBe("completed");
    expect(readKieLifecycleStatus({ status: "cancelled" })).toBe("canceled");
    expect(readKieLifecycleStatus({ code: 200 })).toBe("completed");
    expect(readKieLifecycleStatus({ code: 501 })).toBe("failed");
  });

  it("maps callback fixtures to terminal lifecycle statuses", () => {
    expect(readKieLifecycleStatus(kieKlingCallbackSuccessFixture)).toBe("completed");
    expect(readKieLifecycleStatus(kieKlingCallbackFailureFixture)).toBe("failed");
  });

  it("reads response urls and media payload presence", () => {
    expect(readKieResponseUrl({ response_url: "https://queue.kie.ai/v1/requests/1" })).toBe(
      "https://queue.kie.ai/v1/requests/1"
    );
    expect(
      kiePayloadHasMedia({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toBe(true);
  });

  it("reads content-policy messages from common Kie shapes", () => {
    expect(readKieContentPolicyMessage({ error_message: "Blocked." })).toBe("Blocked.");
    expect(readKieContentPolicyMessage({ detail: { message: "Moderation blocked." } })).toBe(
      "Moderation blocked."
    );
  });

  it("evaluates terminal lifecycle statuses and successful-candidate resolution", () => {
    expect(isKieCompletedStatus("finished")).toBe(true);
    expect(isKieCompletedStatus("running")).toBe(false);
    expect(isKieFailedStatus("fail")).toBe(true);
    expect(isKieFailedStatus("rejected")).toBe(true);
    expect(isKieFailedStatus("running")).toBe(false);
    expect(resolveKieSuccessfulPayloadStatus([null, "processing", "finished"])).toBe("finished");
    expect(resolveKieSuccessfulPayloadStatus([null, "processing"])).toBe("completed");
  });

  it("classifies retryable upstream responses", () => {
    expect(isKieRetryableUpstreamResponse(new Response("{}", { status: 503 }))).toBe(true);
    expect(
      isKieRetryableUpstreamResponse(
        new Response("{}", { status: 400, headers: { "x-kie-retryable": "true" } })
      )
    ).toBe(true);
    expect(
      isKieRetryableUpstreamResponse(
        new Response("{}", { status: 500, headers: { "x-kie-needs-retry": "false" } })
      )
    ).toBe(false);
  });

  it("classifies retryable upstream payload codes", () => {
    expect(isKieRetryableUpstreamPayload({ code: "rate_limit" })).toBe(true);
    expect(isKieRetryableUpstreamPayload({ code: 429 })).toBe(true);
    expect(isKieRetryableUpstreamPayload({ error: { code: "temporarily_unavailable" } })).toBe(
      true
    );
    expect(isKieRetryableUpstreamPayload({ detail: { error_code: "timed_out" } })).toBe(true);
    expect(isKieRetryableUpstreamPayload({ code: "validation_error" })).toBe(false);
  });

  it("fails closed for unsupported model ids when model-aware validation is requested", () => {
    expect(
      validateKieStatusPayloadForModel({
        modelId: "kie-ai/unknown",
        payload: { status: "completed" },
      })
    ).toEqual(
      expect.objectContaining({
        code: "KIE_MODEL_UNSUPPORTED",
      })
    );
    expect(
      kiePayloadHasMedia({
        modelId: "kie-ai/unknown",
        payload: { videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] },
      })
    ).toBe(false);
  });

  it("flags malformed status/result payload field types", () => {
    expect(readKieLifecycleStatus({ status: { value: "running" } })).toBeNull();
    expect(
      readKieResponseUrl({ response_url: { href: "https://queue.kie.ai/v1/requests/1" } })
    ).toBeNull();

    expect(
      validateKieStatusPayloadForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { status: { value: "running" } },
      })
    ).toEqual(
      expect.objectContaining({
        code: "KIE_STATUS_FIELD_INVALID",
      })
    );

    expect(
      validateKieStatusPayloadForModel({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: { response_url: { href: "https://queue.kie.ai/v1/requests/1" } },
      })
    ).toEqual(
      expect.objectContaining({
        code: "KIE_RESPONSE_URL_FIELD_INVALID",
      })
    );

    expect(
      kiePayloadHasMedia({
        modelId: "kie-ai/veo-3.1-fast-i2v",
        payload: {
          status: { value: "completed" },
          videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }],
        },
      })
    ).toBe(false);
  });
});
