/**
 * Regression tests for per-user admin health deep report assembly.
 */
import { describe, expect, it } from "vitest";
import { buildAdminHealthResponse } from "../../lib/server/adminUserHealth/deepReport";

describe("buildAdminHealthResponse", () => {
  it("returns healthy baseline when no risk signals are present", () => {
    const result = buildAdminHealthResponse({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
        created_at: "2026-03-01T00:00:00.000Z",
        last_sign_in_at: "2026-03-15T00:00:00.000Z",
      },
      generationsSelectUsed: "id,status",
      reservationsSupported: true,
      queueSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: {
        user_id: "user-1",
        balance_cents: 500,
        updated_at: "2026-03-17T11:55:00.000Z",
      },
      generations: [],
      reservations: [],
      queueRows: [],
      ledger: [],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.credits).toEqual(
      expect.objectContaining({
        availableCents: 500,
        reservedCents: 0,
        spendableCents: 500,
      })
    );
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "HEALTHY_BASELINE" })])
    );
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });

  it("surfaces linked failure, aged holds, stuck generations, and compatibility warnings", () => {
    const nowMs = Date.parse("2026-03-17T12:00:00.000Z");
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,recovery_state,request_id",
      reservationsSupported: true,
      queueSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: ["legacy queue projection in use"],
      balance: {
        user_id: "user-1",
        balance_cents: 1000,
        updated_at: "2026-03-17T11:55:00.000Z",
      },
      generations: [
        {
          id: "gen-1",
          status: "fail",
          recovery_state: "recovering",
          provider: "fal",
          model_id: "model-1",
          request_id: "req-1",
          created_at: "2026-03-17T10:30:00.000Z",
          completed_at: null,
          failure_reason_code: "provider_timeout",
          next_recovery_at: "2026-03-17T10:45:00.000Z",
        },
      ],
      reservations: [
        {
          id: "res-1",
          status: "reserved",
          source_ref: "src-1",
          provider_request_id: "req-1",
          model_id: "model-1",
          amount_cents: 200,
          metadata: null,
          created_at: "2026-03-17T10:30:00.000Z",
          released_at: null,
          captured_at: null,
        },
      ],
      queueRows: [
        {
          id: "queue-1",
          generation_id: "gen-1",
          status: "exhausted",
          model_id: "model-1",
          source_ref: "src-1",
          attempts: 3,
          created_at: "2026-03-17T09:01:00.000Z",
          updated_at: "2026-03-17T09:10:00.000Z",
          last_error_code: "PROVIDER_TIMEOUT",
        },
      ],
      ledger: [
        {
          id: "ledger-1",
          user_id: "user-1",
          change_cents: -200,
          reason: "generation charge",
          source: "generation_charge",
          source_ref: "src-1",
          metadata: null,
          created_at: "2026-03-17T09:02:00.000Z",
        },
      ],
      nowMs,
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "ACTIVE_RESERVED_HOLDS",
        "STUCK_GENERATIONS",
        "HIGH_FAIL_RATE_24H",
        "CHARGED_LINKED_NON_SUCCESS_GENERATION",
        "EXHAUSTED_QUEUE_ROWS",
        "COMPATIBILITY_1",
      ])
    );
    expect(result.drainage.costWithoutSuccessfulGeneration.linkedNonSuccessGeneration).toEqual(
      expect.objectContaining({
        debitCents: 200,
        rowCount: 1,
      })
    );
    expect(result.generations).toEqual(
      expect.objectContaining({
        stuckOver1hCount: 1,
      })
    );
    expect(result.reservations).toEqual(
      expect.objectContaining({
        reservedWithProviderOver1hCount: 1,
      })
    );
  });

  it("surfaces delayed generations before they cross the critical stuck threshold", () => {
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,recovery_state,request_id",
      reservationsSupported: true,
      queueSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [
        {
          id: "gen-30m",
          status: "running",
          recovery_state: "queued",
          provider: "fal",
          model_id: "model-1",
          request_id: "req-30m",
          created_at: "2026-03-17T11:20:00.000Z",
          completed_at: null,
          failure_reason_code: null,
          next_recovery_at: "2026-03-17T11:22:00.000Z",
        },
      ],
      reservations: [],
      queueRows: [],
      ledger: [],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["DELAYED_GENERATIONS"])
    );
    expect(result.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining(["STUCK_GENERATIONS"])
    );
  });
});
