import { beforeEach, describe, expect, it, vi } from "vitest";
import { debitAccountCredits, grantAccountCredits } from "../../lib/server/api/creditLedger";

const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("creditLedger grant-lot RPC helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns grant RPC status fields for duplicate observability", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          status: "duplicate",
          ledger_id: "ledger-1",
          grant_id: "grant-1",
          message: null,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const result = await grantAccountCredits({
      userId: "user-1",
      amountCents: 100,
      reason: "Monthly allocation",
      source: "subscription_renewal",
      sourceRef: "invoice-1",
      creditKind: "subscription_allocation",
      expiresAt: "2026-09-04T00:00:00.000Z",
    });

    expect(result).toEqual({
      error: null,
      mode: "rich",
      status: "duplicate",
      ledgerId: "ledger-1",
      grantId: "grant-1",
      message: null,
    });
    expect(rpc).toHaveBeenCalledWith("grant_account_credits", {
      p_user_id: "user-1",
      p_amount_cents: 100,
      p_reason: "Monthly allocation",
      p_source: "subscription_renewal",
      p_source_ref: "invoice-1",
      p_credit_kind: "subscription_allocation",
      p_expires_at: "2026-09-04T00:00:00.000Z",
      p_metadata: {},
      p_created_by: null,
    });
  });

  it("rejects grant calls without a source ref before reaching the RPC", async () => {
    const rpc = vi.fn();
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const result = await grantAccountCredits({
      userId: "user-1",
      amountCents: 100,
      reason: "Monthly allocation",
      source: "subscription_renewal",
      sourceRef: null,
      creditKind: "subscription_allocation",
      expiresAt: "2026-09-04T00:00:00.000Z",
    });

    expect(result).toEqual({
      error: { message: "sourceRef is required." },
      mode: "rich",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns debit RPC status fields", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          status: "debited",
          ledger_id: "ledger-2",
          message: null,
        },
      ],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const result = await debitAccountCredits({
      userId: "user-1",
      amountCents: 25,
      reason: "Manual adjustment",
      source: "admin_adjustment",
      sourceRef: "adjustment-1",
    });

    expect(result).toEqual({
      error: null,
      mode: "rich",
      status: "debited",
      ledgerId: "ledger-2",
      grantId: null,
      message: null,
    });
  });

  it("rejects debit calls without a source ref before reaching the RPC", async () => {
    const rpc = vi.fn();
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const result = await debitAccountCredits({
      userId: "user-1",
      amountCents: 25,
      reason: "Manual adjustment",
      source: "admin_adjustment",
      sourceRef: null,
    });

    expect(result).toEqual({
      error: { message: "sourceRef is required." },
      mode: "rich",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
