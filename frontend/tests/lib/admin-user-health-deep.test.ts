/**
 * Regression tests for admin user-health deep-diagnostics parsing helpers.
 */
import { describe, expect, it } from "vitest";
import { asPositiveInt } from "../../lib/server/adminUserHealth/deep";
import { buildAdminHealthResponse } from "../../lib/server/adminUserHealth/deepReport";

describe("admin user-health deep parsing", () => {
  it("uses the fallback for absent or empty positive integer inputs", () => {
    expect(asPositiveInt(null, 30)).toBe(30);
    expect(asPositiveInt(undefined, 30)).toBe(30);
    expect(asPositiveInt("", 30)).toBe(30);
  });

  it("clamps positive integer inputs to at least one", () => {
    expect(asPositiveInt("0", 30)).toBe(1);
    expect(asPositiveInt("-5", 30)).toBe(1);
    expect(asPositiveInt("12.8", 30)).toBe(12);
  });

  it("recognizes direct-route generation projection media as successful charge evidence", () => {
    const response = buildAdminHealthResponse({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 7,
      authUser: {
        id: "user-1",
        email: "user@example.com",
        created_at: "2026-04-01T00:00:00.000Z",
        last_sign_in_at: "2026-04-30T00:00:00.000Z",
      },
      generationsSelectUsed: "test",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: {
        user_id: "user-1",
        balance_cents: 100,
        updated_at: "2026-04-30T00:00:00.000Z",
      },
      generations: [],
      attempts: [],
      outputs: [],
      generationProjectionBillingRows: [
        {
          generation_id: "gen-audio-1",
          source_ref: "sync-request-1",
          request_id: "sync-request-1",
          provider_request_id: "provider-request-1",
          status: "success",
          task_state: "success",
          result_urls: ["https://example.test/audio.mp3"],
          preview_url: null,
        },
      ],
      reservations: [
        {
          id: "reservation-1",
          status: "captured",
          source_ref: "sync-request-1",
          provider_request_id: "provider-request-1",
          model_id: "eleven_v3",
          amount_cents: 5,
          metadata: null,
          created_at: "2026-04-30T00:00:00.000Z",
          released_at: null,
          captured_at: "2026-04-30T00:00:05.000Z",
        },
      ],
      creditGrantSummary: {
        spendableCents: 95,
        reservedCents: 0,
        expiringCents: 95,
        nonExpiringCents: 0,
        nextExpiringCents: 95,
        nextExpiresAt: null,
      },
      ledger: [
        {
          id: "ledger-1",
          user_id: "user-1",
          change_cents: -5,
          reason: "ElevenLabs generation completed.",
          source: "generation_charge",
          source_ref: "sync-request-1",
          metadata: {
            provider_request_id: "provider-request-1",
            generation_id: "gen-audio-1",
          },
          created_at: "2026-04-30T00:00:05.000Z",
        },
      ],
      nowMs: Date.parse("2026-04-30T00:01:00.000Z"),
    });

    expect(response.drainage.costWithoutSuccessfulGeneration.debitCents).toBe(0);
    expect(response.findings.map((finding) => finding.code)).not.toContain(
      "CHARGED_MISSING_LINKAGE_DATA"
    );
  });
});
