import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE,
  resolveCreditTopUpEligibilityForUser,
} from "../creditTopUpEligibility";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const mockContractLookup = (result: { data: unknown; error: unknown }) => {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const order = vi.fn().mockReturnValue({ limit });
  const is = vi.fn().mockReturnValue({ order });
  const eq = vi.fn().mockReturnValue({ is });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  getSupabaseAdminMock.mockReturnValue({ from });

  return { from, select, eq, is, order, limit, maybeSingle };
};

describe("resolveCreditTopUpEligibilityForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses billing subscription contracts as the paid-account authority", async () => {
    const chain = mockContractLookup({
      data: {
        id: "contract-1",
        status: "active",
        plan_id: "business",
        contract_source: "stripe",
      },
      error: null,
    });

    const result = await resolveCreditTopUpEligibilityForUser("user-1");

    expect(chain.from).toHaveBeenCalledWith("billing_subscription_contracts");
    expect(chain.select).toHaveBeenCalledWith("id, status, plan_id, contract_source");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.is).toHaveBeenCalledWith("ended_at", null);
    expect(result).toEqual({ eligible: true, contractId: "contract-1" });
  });

  it("allows active internal subscription contracts without trusting billing profile fallbacks", async () => {
    mockContractLookup({
      data: {
        id: "contract-2",
        status: "trialing",
        plan_id: "studio",
        contract_source: "internal_comp",
      },
      error: null,
    });

    await expect(resolveCreditTopUpEligibilityForUser("user-1")).resolves.toEqual({
      eligible: true,
      contractId: "contract-2",
    });
  });

  it("blocks users without an open subscription contract", async () => {
    mockContractLookup({ data: null, error: null });

    await expect(resolveCreditTopUpEligibilityForUser("user-1")).resolves.toEqual({
      eligible: false,
      reason: "missing_subscription_contract",
    });
  });

  it("blocks inactive subscription contracts", async () => {
    mockContractLookup({
      data: {
        id: "contract-3",
        status: "canceled",
        plan_id: "business",
        contract_source: "stripe",
      },
      error: null,
    });

    await expect(resolveCreditTopUpEligibilityForUser("user-1")).resolves.toEqual({
      eligible: false,
      reason: "inactive_subscription_contract",
    });
  });

  it("blocks free subscription contracts", async () => {
    mockContractLookup({
      data: {
        id: "contract-4",
        status: "active",
        plan_id: "free",
        contract_source: "stripe",
      },
      error: null,
    });

    await expect(resolveCreditTopUpEligibilityForUser("user-1")).resolves.toEqual({
      eligible: false,
      reason: "free_subscription_contract",
    });
  });

  it("fails closed when the contract lookup fails", async () => {
    mockContractLookup({
      data: null,
      error: { message: "permission denied for table billing_subscription_contracts" },
    });

    await expect(resolveCreditTopUpEligibilityForUser("user-1")).rejects.toThrow(
      "permission denied for table billing_subscription_contracts"
    );
  });

  it("exports the route-safe customer message", () => {
    expect(CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE).toBe(
      "Choose a paid subscription plan before buying credit top-ups."
    );
  });
});
