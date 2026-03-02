/**
 * Unit coverage for Kie submit transport normalization helpers.
 */

import { describe, expect, it } from "vitest";
import { normalizeKieSubmitTransportResult } from "../kieSubmitTransportContracts";

describe("kieSubmitTransportContracts", () => {
  it("keeps successful 200/200 payloads unchanged", () => {
    const response = new Response(JSON.stringify({ code: 200, data: { taskId: "task-1" } }), {
      status: 200,
    });
    const data = { code: 200, data: { taskId: "task-1" } };

    const normalized = normalizeKieSubmitTransportResult({ response, data });

    expect(normalized.response.status).toBe(200);
    expect(normalized.bodyCode).toBe(200);
    expect(normalized.logicalStatus).toBe(200);
  });

  it("maps HTTP 200 payload code failures to logical HTTP failure status", () => {
    const response = new Response(JSON.stringify({ code: 402, msg: "credits" }), { status: 200 });
    const data = { code: 402, msg: "credits" };

    const normalized = normalizeKieSubmitTransportResult({ response, data });

    expect(normalized.response.status).toBe(402);
    expect(normalized.response.ok).toBe(false);
    expect(normalized.bodyCode).toBe(402);
    expect(normalized.logicalStatus).toBe(402);
  });

  it("reads nested body code aliases from data envelopes", () => {
    const response = new Response(JSON.stringify({ data: { code: 455 } }), { status: 200 });
    const data = { data: { code: 455 } };

    const normalized = normalizeKieSubmitTransportResult({ response, data });

    expect(normalized.response.status).toBe(455);
    expect(normalized.bodyCode).toBe(455);
    expect(normalized.logicalStatus).toBe(455);
  });
});
