import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/auth/signup-intent";

const enforceApiRateLimitMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
  resolveApiClientIp: () => "203.0.113.9",
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn(),
});

type MockOfferQuery = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

const createOfferQuery = (result: unknown) => {
  const query = {} as MockOfferQuery;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.is = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn().mockResolvedValue(result);
  return query;
};

describe("POST /api/auth/signup-intent", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    enforceApiRateLimitMock.mockReturnValue(true);
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("keeps signup intent creation closed when explicitly disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "false");
    const req = {
      method: "POST",
      body: {
        email: "buyer@example.com",
        nextPath: "/pricing?intent=create-project&plan=starter",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Account creation is temporarily closed.",
    });
    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("rejects unsafe signup paths before touching Supabase", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const req = {
      method: "POST",
      body: {
        email: "buyer@example.com",
        nextPath: "https://evil.example/dashboard",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose where to continue after creating an account.",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("stores an account-first signup intent without requiring a paid offer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === "signup_intents") return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });
    const req = {
      method: "POST",
      body: {
        email: " Explorer@Example.com ",
        nextPath: "/ai-studio",
      },
      headers: {
        "user-agent": "Signup Test Browser",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).not.toHaveBeenCalledWith("billing_plan_offers");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        match_strategy: "email_hash",
        signup_context: "account",
        plan_id: null,
        billing_interval: null,
        pricing_intent: null,
        next_path: "/ai-studio",
        offer_id: null,
        created_ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        user_agent_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    );
    expect(insertMock.mock.calls[0]?.[0]).not.toHaveProperty("email");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      expiresAt: expect.any(String),
    });
  });

  it("stores a short Google IP-bound signup intent when no email is available yet", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === "signup_intents") return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });
    const req = {
      method: "POST",
      body: {
        provider: "google",
        nextPath: "/ai-studio",
      },
      headers: {
        "user-agent": "Google Signup Test Browser",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).not.toHaveBeenCalledWith("billing_plan_offers");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email_hash: null,
        match_strategy: "google_ip",
        signup_context: "account",
        plan_id: null,
        billing_interval: null,
        pricing_intent: null,
        next_path: "/ai-studio",
        offer_id: null,
        created_ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        user_agent_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      expiresAt: expect.any(String),
    });
  });

  it("rejects a malformed submitted Google signup email instead of falling back to IP matching", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const req = {
      method: "POST",
      body: {
        provider: "google",
        email: "not-an-email",
        nextPath: "/ai-studio",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Enter a valid email before creating an account.",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("rejects signup intents when the selected paid offer is not active", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const offerQuery = createOfferQuery({
      data: [],
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => offerQuery),
    });
    const req = {
      method: "POST",
      body: {
        email: "buyer@example.com",
        nextPath: "/pricing?intent=create-project&plan=starter",
      },
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "The selected plan is not currently available.",
    });
  });

  it("stores a hashed-email intent for a current paid acquisition offer", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHORTPULSE_PUBLIC_SIGNUP_ENABLED", "true");
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const offerQuery = createOfferQuery({
      data: [
        {
          id: "media_current_month",
          recurring_price_cents: 1900,
          stripe_price_id: "price_media_month",
        },
      ],
      error: null,
    });
    const fromMock = vi.fn((table: string) => {
      if (table === "billing_plan_offers") return offerQuery;
      if (table === "signup_intents") return { insert: insertMock };
      throw new Error(`Unexpected table ${table}`);
    });
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });
    const req = {
      method: "POST",
      body: {
        email: " Buyer@Example.com ",
        nextPath: "/pricing?intent=open-projects&plan=media&interval=month",
      },
      headers: {
        "user-agent": "Signup Test Browser",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("billing_plan_offers");
    expect(offerQuery.eq).toHaveBeenCalledWith("plan_id", "media");
    expect(offerQuery.eq).toHaveBeenCalledWith("billing_interval", "month");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        match_strategy: "email_hash",
        signup_context: "pricing",
        plan_id: "media",
        billing_interval: "month",
        pricing_intent: "open-projects",
        next_path: "/pricing?intent=open-projects&plan=media&interval=month",
        offer_id: "media_current_month",
        created_ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        user_agent_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      })
    );
    expect(insertMock.mock.calls[0]?.[0]).not.toHaveProperty("email");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      expiresAt: expect.any(String),
    });
  });
});
