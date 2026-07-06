import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertPaidMediaLibraryAccess,
  hasPaidMediaLibraryAccess,
  MediaLibraryPaidAccessError,
} from "../mediaLibraryPaidAccess";

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

describe("mediaLibraryPaidAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows current non-baseline subscription contracts", async () => {
    const chain = mockContractLookup({
      data: { plan_id: "starter", status: "active" },
      error: null,
    });

    await expect(hasPaidMediaLibraryAccess("user-1")).resolves.toBe(true);

    expect(chain.from).toHaveBeenCalledTimes(1);
    expect(chain.from).toHaveBeenCalledWith("billing_subscription_contracts");
    expect(chain.select).toHaveBeenCalledWith("plan_id,status");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.is).toHaveBeenCalledWith("ended_at", null);
  });

  it("does not trust billing profile-only paid projections", async () => {
    const chain = mockContractLookup({ data: null, error: null });

    await expect(hasPaidMediaLibraryAccess("user-1")).resolves.toBe(false);

    expect(chain.from).toHaveBeenCalledTimes(1);
    expect(chain.from).not.toHaveBeenCalledWith("billing_profiles");
  });

  it("blocks baseline contracts", async () => {
    mockContractLookup({
      data: { plan_id: "free", status: "active" },
      error: null,
    });

    await expect(assertPaidMediaLibraryAccess("user-1")).rejects.toBeInstanceOf(
      MediaLibraryPaidAccessError
    );
  });

  it("fails closed when contract authority cannot be read", async () => {
    mockContractLookup({
      data: null,
      error: { message: "permission denied for table billing_subscription_contracts" },
    });

    await expect(hasPaidMediaLibraryAccess("user-1")).rejects.toThrow(
      "permission denied for table billing_subscription_contracts"
    );
  });
});
