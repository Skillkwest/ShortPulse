import { describe, expect, it } from "vitest";
import { normalizeApiExceptionForLog } from "../../lib/server/api/appErrorLogs";

describe("normalizeApiExceptionForLog", () => {
  it("keeps Supabase/PostgREST object exceptions readable", () => {
    const normalized = normalizeApiExceptionForLog({
      message: "RPC failed",
      code: "PGRST202",
      details: "Could not find the public.claim_generation_recovery_batch function",
      hint: "Reload the schema cache",
    });

    expect(normalized.message).toBe("RPC failed");
    expect(normalized.message).not.toBe("[object Object]");
    expect(normalized.stack).toBeNull();
    expect(normalized.metadata).toMatchObject({
      exception_code: "PGRST202",
      exception_details: "Could not find the public.claim_generation_recovery_batch function",
      exception_hint: "Reload the schema cache",
    });
  });

  it("falls back to object details when message is unavailable", () => {
    const normalized = normalizeApiExceptionForLog({
      code: "42P01",
      details: "relation generation_queue does not exist",
    });

    expect(normalized.message).toBe("relation generation_queue does not exist");
    expect(normalized.metadata).toMatchObject({
      exception_code: "42P01",
      exception_details: "relation generation_queue does not exist",
    });
  });

  it("serializes unstructured objects instead of logging [object Object]", () => {
    const normalized = normalizeApiExceptionForLog({
      reason: "schema mismatch",
      nested: { stage: "claim_generation_recovery_batch_rpc" },
    });

    expect(normalized.message).toContain("schema mismatch");
    expect(normalized.message).not.toBe("[object Object]");
    expect(normalized.metadata.exception_payload).toContain("schema mismatch");
  });
});
