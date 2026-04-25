import { beforeEach, describe, expect, it, vi } from "vitest";
import emailHandler from "../../pages/api/account/email/update";
import profileHandler from "../../pages/api/account/profile/update";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const updateSupabaseAuthUserMock = vi.fn();
const syncStripeCustomerForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/accountIdentity", async () => {
  const actual = await vi.importActual<typeof import("../../lib/server/api/accountIdentity")>(
    "../../lib/server/api/accountIdentity"
  );
  return {
    ...actual,
    updateSupabaseAuthUser: (...args: unknown[]) => updateSupabaseAuthUserMock(...args),
  };
});

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  syncStripeCustomerForUser: (...args: unknown[]) => syncStripeCustomerForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("account identity routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {
        display_name: "Original Name",
      },
    });
    updateSupabaseAuthUserMock.mockResolvedValue({});
    syncStripeCustomerForUserMock.mockResolvedValue({
      stripeCustomerId: "cus_123",
      created: false,
      updated: true,
      email: "user@example.com",
      name: "Original Name",
    });
  });

  it("updates display name through the server-owned profile route", async () => {
    const req = {
      method: "POST",
      body: { displayName: "Alice Example" },
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await profileHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: {
        data: {
          display_name: "Alice Example",
          full_name: "Alice Example",
        },
      },
    });
    expect(syncStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      displayName: "Alice Example",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ displayName: "Alice Example" });
  });

  it("updates email through the server-owned email route", async () => {
    const req = {
      method: "POST",
      body: { email: "alice@example.com" },
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: { email: "alice@example.com" },
    });
    expect(syncStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "alice@example.com",
      displayName: "Original Name",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      email: "alice@example.com",
      confirmationRequired: true,
    });
  });
});
