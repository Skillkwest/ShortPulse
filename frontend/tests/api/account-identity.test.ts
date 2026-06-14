import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import confirmEmailHandler from "../../pages/api/account/email/confirm";
import emailHandler from "../../pages/api/account/email/update";
import profileHandler from "../../pages/api/account/profile/update";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const updateSupabaseAuthUserMock = vi.fn();
const verifySupabasePasswordMock = vi.fn();
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
    verifySupabasePassword: (...args: unknown[]) => verifySupabasePasswordMock(...args),
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
  afterEach(() => {
    delete process.env.APP_BASE_URL;
    delete process.env.SHORTPULSE_PUBLIC_API_BASE_URL;
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      user_metadata: {
        display_name: "Original Name",
      },
    });
    updateSupabaseAuthUserMock.mockResolvedValue({});
    verifySupabasePasswordMock.mockResolvedValue(true);
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

  it("keeps a successful profile update when downstream Stripe sync fails", async () => {
    syncStripeCustomerForUserMock.mockRejectedValueOnce(
      new Error("Stripe customer mode mismatch detected.")
    );
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
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "account/profile/update.stripe-sync",
      user: expect.objectContaining({ id: "user-1" }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ displayName: "Alice Example" });
  });

  it("updates email through the server-owned email route using forwarded request origin when no canonical base url is configured", async () => {
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "internal.shortpulse.test",
        "x-forwarded-host": "app.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: { email: "alice@example.com" },
      emailRedirectTo:
        "https://app.shortpulse.test/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount",
    });
    expect(syncStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      email: "alice@example.com",
      confirmationRequired: true,
    });
  });

  it("prefers the request origin outside production when it differs from APP_BASE_URL", async () => {
    process.env.APP_BASE_URL = "https://canonical.shortpulse.test/base/path";
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "internal.shortpulse.test",
        "x-forwarded-host": "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: { email: "alice@example.com" },
      emailRedirectTo:
        "https://preview.shortpulse.test/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount",
    });
  });

  it("uses SHORTPULSE_PUBLIC_API_BASE_URL when preview cannot resolve an external request host", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://preview.shortpulse.test/base/path";
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "localhost:3000",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: { email: "alice@example.com" },
      emailRedirectTo:
        "https://preview.shortpulse.test/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount",
    });
  });

  it("ignores a loopback APP_BASE_URL when the request arrives on a real external host", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    process.env.APP_BASE_URL = "http://localhost:3000";
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "internal.shortpulse.test",
        "x-forwarded-host": "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).toHaveBeenCalledWith({
      req,
      payload: { email: "alice@example.com" },
      emailRedirectTo:
        "https://www.shortpulse.ai/auth/callback?flow=email-change&next=%2Fprofile%3Fsection%3Daccount",
    });
  });

  it("fails the email change request in production when no approved public auth origin can be resolved", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    process.env.APP_BASE_URL = "https://preview.shortpulse.test";
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update your email." });
  });

  it("fails the email change request in production-built runtimes with unapproved forwarded hosts", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "internal.shortpulse.test",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update your email." });
  });

  it("fails the email change request when APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL disagree", async () => {
    process.env.APP_BASE_URL = "https://canonical.shortpulse.test";
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://preview.shortpulse.test";
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "secret-pass" },
      headers: {
        authorization: "Bearer token",
        host: "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(updateSupabaseAuthUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to update your email." });
  });

  it("requires the current password before updating email", async () => {
    const req = {
      method: "POST",
      body: { email: "alice@example.com" },
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(verifySupabasePasswordMock).not.toHaveBeenCalled();
    expect(updateSupabaseAuthUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Enter your current password." });
  });

  it("rejects the email update when the current password is incorrect", async () => {
    verifySupabasePasswordMock.mockResolvedValueOnce(false);
    const req = {
      method: "POST",
      body: { email: "alice@example.com", currentPassword: "wrong-pass" },
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await emailHandler(req as never, res as never);

    expect(verifySupabasePasswordMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "wrong-pass",
    });
    expect(updateSupabaseAuthUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Current password is incorrect." });
  });

  it("rate limits repeated email update attempts for the same authenticated user", async () => {
    for (let index = 0; index < 5; index += 1) {
      const req = {
        method: "POST",
        body: { email: `alice${index}@example.com`, currentPassword: "secret-pass" },
        headers: { authorization: "Bearer token" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();
      await emailHandler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: { email: "blocked@example.com", currentPassword: "secret-pass" },
      headers: { authorization: "Bearer token" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await emailHandler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("syncs Stripe only after the confirmed email route runs with the authenticated user state", async () => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await confirmEmailHandler(req as never, res as never);

    expect(syncStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      displayName: "Original Name",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ email: "user@example.com" });
  });

  it("keeps confirmed email completion when downstream Stripe sync fails", async () => {
    syncStripeCustomerForUserMock.mockRejectedValueOnce(
      new Error("No such customer: 'cus_sensitive_123'; a similar object exists in test mode.")
    );
    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
    };
    const res = createMockResponse();

    await confirmEmailHandler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "account/email/confirm.stripe-sync",
      user: expect.objectContaining({ id: "user-1" }),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ email: "user@example.com" });
  });
});
