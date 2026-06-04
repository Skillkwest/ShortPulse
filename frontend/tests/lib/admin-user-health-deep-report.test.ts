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
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: {
        user_id: "user-1",
        balance_cents: 500,
        updated_at: "2026-03-17T11:55:00.000Z",
      },
      generations: [],
      attempts: [],
      outputs: [],
      reservations: [],
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
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
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
      attempts: [],
      outputs: [],
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
      attempts: [],
      outputs: [],
      reservations: [],
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

  it("uses attempt linkage and canonical outputs to reduce false missing-linkage diagnosis", () => {
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
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [
        {
          id: "gen-attempt-1",
          status: "running",
          recovery_state: "queued",
          provider: "fal",
          model_id: "model-1",
          request_id: null,
          created_at: "2026-03-17T10:30:00.000Z",
          completed_at: null,
          failure_reason_code: null,
          next_recovery_at: "2026-03-17T10:45:00.000Z",
        },
      ],
      attempts: [
        {
          id: "attempt-1",
          generation_id: "gen-attempt-1",
          provider_request_id: "req-attempt-1",
          status: "running",
          created_at: "2026-03-17T10:31:00.000Z",
        },
      ],
      outputs: [
        {
          id: "output-1",
          generation_id: "gen-attempt-1",
          media_file_id: "file-1",
          created_at: "2026-03-17T10:40:00.000Z",
        },
      ],
      reservations: [
        {
          id: "res-1",
          status: "reserved",
          source_ref: "src-1",
          provider_request_id: "req-attempt-1",
          model_id: "model-1",
          amount_cents: 200,
          metadata: null,
          created_at: "2026-03-17T10:30:00.000Z",
          released_at: null,
          captured_at: null,
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
          created_at: "2026-03-17T10:41:00.000Z",
        },
      ],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.generations.stuckOver1hCount).toBe(1);
    expect(result.drainage.costWithoutSuccessfulGeneration.debitCents).toBe(0);
    expect(result.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining([
        "CHARGED_MISSING_LINKAGE_DATA",
        "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      ])
    );
  });

  it("does not classify user-abandoned no-refund captures as billing leakage", () => {
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,recovery_state,request_id,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [
        {
          id: "gen-abandoned",
          status: "fail",
          recovery_state: "exhausted",
          provider: "fal",
          model_id: "fal-ai/nano-banana-2/edit",
          request_id: "req-abandoned",
          created_at: "2026-03-17T11:30:00.000Z",
          completed_at: "2026-03-17T11:35:00.000Z",
          failure_reason_code: "user_abandoned",
          next_recovery_at: null,
          metadata: {
            user_abandoned: true,
            abandoned_no_refund: true,
          },
        },
      ],
      attempts: [],
      outputs: [],
      reservations: [
        {
          id: "res-abandoned",
          status: "captured",
          source_ref: "src-abandoned",
          provider_request_id: "req-abandoned",
          model_id: "fal-ai/nano-banana-2/edit",
          amount_cents: 10,
          metadata: {
            debited_credits: 10,
          },
          created_at: "2026-03-17T11:30:00.000Z",
          released_at: null,
          captured_at: "2026-03-17T11:35:00.000Z",
        },
      ],
      ledger: [
        {
          id: "ledger-abandoned",
          user_id: "user-1",
          change_cents: -10,
          reason: "generation charge",
          source: "generation_charge",
          source_ref: "src-abandoned",
          metadata: null,
          created_at: "2026-03-17T11:35:00.000Z",
        },
      ],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.generations.last24h.fail).toBe(0);
    expect(result.drainage.costWithoutSuccessfulGeneration.debitCents).toBe(0);
    expect(result.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining(["HIGH_FAIL_RATE_24H", "CHARGED_LINKED_NON_SUCCESS_GENERATION"])
    );
  });

  it("nets generation refunds and direct projection success before flagging charge leakage", () => {
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,recovery_state,request_id,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [],
      attempts: [],
      outputs: [],
      reservations: [],
      generationProjectionBillingRows: [
        {
          generation_id: "gen-audio",
          source_ref: "src-audio",
          request_id: "src-audio",
          provider_request_id: "provider-audio",
          status: "success",
          task_state: "success",
          result_urls: ["https://cdn.test/audio.mp3"],
          preview_url: "https://cdn.test/audio.mp3",
        },
      ],
      ledger: [
        {
          id: "ledger-openai-charge",
          user_id: "user-1",
          change_cents: -20,
          reason: "openai image generation",
          source: "generation_charge",
          source_ref: "src-refunded",
          metadata: null,
          created_at: "2026-03-17T11:00:00.000Z",
        },
        {
          id: "ledger-openai-refund",
          user_id: "user-1",
          change_cents: 20,
          reason: "Auto-refund: OpenAI image generation failed.",
          source: "generation_refund",
          source_ref: "src-refunded",
          metadata: null,
          created_at: "2026-03-17T11:00:01.000Z",
        },
        {
          id: "ledger-audio-charge",
          user_id: "user-1",
          change_cents: -5,
          reason: "elevenlabs text to speech generation",
          source: "generation_charge",
          source_ref: "src-audio",
          metadata: {
            provider_request_id: "provider-audio",
          },
          created_at: "2026-03-17T11:05:00.000Z",
        },
      ],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.drainage.costWithoutSuccessfulGeneration.debitCents).toBe(0);
    expect(result.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining([
        "CHARGED_MISSING_LINKAGE_DATA",
        "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      ])
    );
  });

  it("uses projection request lineage when charge source_ref differs from projection source_ref", () => {
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,recovery_state,request_id,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [],
      attempts: [],
      outputs: [],
      reservations: [
        {
          id: "res-provider-lineage",
          status: "captured",
          source_ref: "ledger-source-ref",
          provider_request_id: "provider-request-1",
          model_id: "music_v1",
          amount_cents: 5,
          metadata: null,
          created_at: "2026-03-17T11:05:00.000Z",
          released_at: null,
          captured_at: "2026-03-17T11:06:00.000Z",
        },
      ],
      generationProjectionBillingRows: [
        {
          generation_id: "gen-provider-lineage",
          source_ref: "projection-source-ref",
          request_id: "provider-request-1",
          provider_request_id: null,
          status: "success",
          task_state: "success",
          result_urls: ["https://cdn.test/audio.mp3"],
          preview_url: null,
        },
      ],
      ledger: [
        {
          id: "ledger-provider-lineage",
          user_id: "user-1",
          change_cents: -5,
          reason: "elevenlabs music generation",
          source: "generation_charge",
          source_ref: "ledger-source-ref",
          metadata: null,
          created_at: "2026-03-17T11:06:00.000Z",
        },
      ],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.drainage.costWithoutSuccessfulGeneration.debitCents).toBe(0);
    expect(result.findings.map((finding) => finding.code)).not.toEqual(
      expect.arrayContaining([
        "CHARGED_MISSING_LINKAGE_DATA",
        "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      ])
    );
  });

  it("surfaces generation output, project association, and terminal hold invariants", () => {
    const result = buildAdminHealthResponse({
      lookup: "user-1",
      lookupMode: "user_id",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,request_id,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: {
        user_id: "user-1",
        balance_cents: 500,
        updated_at: "2026-03-17T11:55:00.000Z",
      },
      generations: [
        {
          id: "gen-success-no-output",
          status: "success",
          recovery_state: null,
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          request_id: "req-success-no-output",
          created_at: "2026-03-17T11:00:00.000Z",
          completed_at: "2026-03-17T11:01:00.000Z",
          failure_reason_code: null,
          next_recovery_at: null,
          metadata: {
            shortpulse_context: {
              project_id: "project-1",
            },
          },
        },
        {
          id: "gen-associated",
          status: "success",
          recovery_state: null,
          provider: "elevenlabs",
          model_id: "music_v1",
          request_id: "req-associated",
          created_at: "2026-03-17T11:05:00.000Z",
          completed_at: "2026-03-17T11:06:00.000Z",
          failure_reason_code: null,
          next_recovery_at: null,
          metadata: {
            project_id: "project-2",
          },
        },
      ],
      attempts: [],
      outputs: [
        {
          id: "output-1",
          generation_id: "gen-associated",
          media_file_id: "media-1",
          created_at: "2026-03-17T11:06:00.000Z",
        },
      ],
      projectGenerationItems: [
        {
          project_id: "project-2",
          generation_id: "gen-associated",
          user_id: "user-1",
        },
      ],
      reservations: [
        {
          id: "res-terminal",
          status: "reserved",
          source_ref: "src-terminal",
          provider_request_id: "req-associated",
          model_id: "music_v1",
          amount_cents: 50,
          metadata: null,
          created_at: "2026-03-17T11:05:00.000Z",
          released_at: null,
          captured_at: null,
        },
      ],
      ledger: [],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "SUCCESS_WITHOUT_OUTPUTS",
        "PROJECT_GENERATION_ASSOCIATION_DRIFT",
        "RESERVED_HOLD_LINKED_TERMINAL_GENERATION",
      ])
    );
    expect(result.generations).toEqual(
      expect.objectContaining({
        successWithoutOutputCount: 1,
        projectScopedSuccessMissingAssociationCount: 1,
      })
    );
    expect(result.reservations.reservedLinkedTerminalGenerationCount).toBe(1);
  });

  it("ignores project association drift for metadata that points at deleted projects", () => {
    const result = buildAdminHealthResponse({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: {
        user_id: "user-1",
        balance_cents: 500,
        updated_at: "2026-03-17T11:55:00.000Z",
      },
      generations: [
        {
          id: "gen-deleted-project",
          status: "success",
          recovery_state: null,
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          request_id: "req-deleted-project",
          created_at: "2026-03-17T11:00:00.000Z",
          completed_at: "2026-03-17T11:01:00.000Z",
          failure_reason_code: null,
          next_recovery_at: null,
          metadata: {
            shortpulse_context: {
              project_id: "deleted-project",
            },
          },
        },
      ],
      attempts: [],
      outputs: [
        {
          id: "output-1",
          generation_id: "gen-deleted-project",
          media_file_id: "media-1",
          created_at: "2026-03-17T11:06:00.000Z",
        },
      ],
      projectGenerationItems: [],
      activeProjectIds: ["active-project"],
      reservations: [],
      ledger: [],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.findings.map((finding) => finding.code)).not.toContain(
      "PROJECT_GENERATION_ASSOCIATION_DRIFT"
    );
    expect(result.generations.projectScopedSuccessMissingAssociationCount).toBe(0);
  });

  it("does not flag missing project_generation_items when projection owns project visibility", () => {
    const result = buildAdminHealthResponse({
      lookup: "user@example.com",
      lookupMode: "email",
      lookbackDays: 30,
      authUser: {
        id: "user-1",
        email: "user@example.com",
      },
      generationsSelectUsed: "id,status,metadata",
      reservationsSupported: true,
      ledgerLegacySchema: false,
      compatibilityWarnings: [],
      balance: null,
      generations: [
        {
          id: "gen-projection-project",
          status: "success",
          recovery_state: null,
          provider: "fal",
          model_id: "fal-ai/nano-banana-2",
          request_id: "req-projection-project",
          created_at: "2026-03-17T11:00:00.000Z",
          completed_at: "2026-03-17T11:01:00.000Z",
          failure_reason_code: null,
          next_recovery_at: null,
          metadata: {
            shortpulse_context: {
              project_id: "project-1",
            },
          },
        },
      ],
      attempts: [],
      outputs: [
        {
          id: "output-1",
          generation_id: "gen-projection-project",
          media_file_id: "media-1",
          created_at: "2026-03-17T11:06:00.000Z",
        },
      ],
      projectGenerationItems: [],
      generationProjectionProjects: [
        {
          project_id: "project-1",
          generation_id: "gen-projection-project",
          user_id: "user-1",
        },
      ],
      activeProjectIds: ["project-1"],
      reservations: [],
      ledger: [],
      nowMs: Date.parse("2026-03-17T12:00:00.000Z"),
    });

    expect(result.findings.map((finding) => finding.code)).not.toContain(
      "PROJECT_GENERATION_ASSOCIATION_DRIFT"
    );
    expect(result.generations.projectScopedSuccessMissingAssociationCount).toBe(0);
  });
});
