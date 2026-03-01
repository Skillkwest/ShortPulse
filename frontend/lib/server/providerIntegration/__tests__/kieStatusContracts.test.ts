/**
 * Unit coverage for Kie status/result contract helpers.
 */

import { describe, expect, it } from "vitest";
import {
  isKieCompletedStatus,
  isKieFailedStatus,
  isKieRetryableUpstreamResponse,
  kiePayloadHasMedia,
  readKieContentPolicyMessage,
  readKieLifecycleStatus,
  readKieResponseUrl,
  resolveKieSuccessfulPayloadStatus,
} from "../kieStatusContracts";

describe("kieStatusContracts", () => {
  it("normalizes lifecycle status aliases from Kie payloads", () => {
    expect(readKieLifecycleStatus({ state: "in_progress" })).toBe("running");
    expect(readKieLifecycleStatus({ status: "processing" })).toBe("running");
    expect(readKieLifecycleStatus({ status: "done" })).toBe("completed");
    expect(readKieLifecycleStatus({ status: "cancelled" })).toBe("canceled");
  });

  it("reads response urls and media payload presence", () => {
    expect(readKieResponseUrl({ response_url: "https://queue.kie.ai/v1/requests/1" })).toBe(
      "https://queue.kie.ai/v1/requests/1"
    );
    expect(kiePayloadHasMedia({ videos: [{ url: "https://cdn.shortpulse.test/video.mp4" }] })).toBe(
      true
    );
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
});
