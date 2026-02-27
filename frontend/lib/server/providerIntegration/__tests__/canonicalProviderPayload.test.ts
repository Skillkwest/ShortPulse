/**
 * Unit coverage for provider-neutral payload identity parsing helpers.
 */
import { describe, expect, it } from "vitest";
import {
  readCanonicalProviderEventId,
  readCanonicalProviderRequestId,
  readCanonicalProviderStatus,
} from "../canonicalProviderPayload";

describe("canonicalProviderPayload", () => {
  it("reads strict request-id aliases from nested payload records", () => {
    const payload = {
      data: {
        result: {
          requestId: "req-nested-1",
        },
      },
    };

    expect(readCanonicalProviderRequestId(payload)).toBe("req-nested-1");
  });

  it("reads task-style request-id aliases", () => {
    const payload = { task_id: "task-123" };
    expect(readCanonicalProviderRequestId(payload)).toBe("task-123");
  });

  it("only uses generic id alias when explicitly enabled", () => {
    const payload = { id: "provider-op-1" };
    expect(readCanonicalProviderRequestId(payload)).toBeNull();
    expect(readCanonicalProviderRequestId(payload, { allowGenericId: true })).toBe("provider-op-1");
  });

  it("reads event-id aliases", () => {
    expect(readCanonicalProviderEventId({ event_id: "evt-1" })).toBe("evt-1");
    expect(readCanonicalProviderEventId({ eventId: "evt-2" })).toBe("evt-2");
    expect(readCanonicalProviderEventId({ id: "evt-3" })).toBe("evt-3");
  });

  it("normalizes status aliases from nested records", () => {
    const payload = {
      payload: {
        state: "Completed",
      },
    };

    expect(readCanonicalProviderStatus(payload)).toBe("completed");
  });
});
