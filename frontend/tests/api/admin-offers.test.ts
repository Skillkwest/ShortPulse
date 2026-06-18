/**
 * API tests for admin-managed dashboard offers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/offers/index";

const requireAdminUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const savedOfferRow = {
  id: "offer-1",
  eyebrow: "Launch deal",
  title: "Save 30% on Studio",
  description: "Discount for the Studio plan.",
  offer_kind: "plan",
  discount_label: "Save 30%",
  target_label: "Studio monthly",
  cta_label: "View plan",
  cta_href: "/pricing?plan=studio",
  display_order: 1,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_at: "2026-04-30T00:00:00.000Z",
  updated_at: "2026-04-30T00:00:00.000Z",
};

describe("/api/admin/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "DELETE", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("logs admin auth verifier exceptions before offer reads or writes", async () => {
    const authError = new Error("auth verifier unavailable");
    requireAdminUserMock.mockRejectedValueOnce(authError);
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: authError,
      routeLabel: "admin/offers.auth",
      scope: "app",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to save dashboard offers." });
  });

  it("rejects external CTA hrefs", async () => {
    const req = {
      method: "POST",
      body: {
        title: "External offer",
        ctaHref: "https://example.com",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "CTA href must be an internal path." });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("creates a normalized dashboard offer", async () => {
    const maybeSingleMock = vi.fn(async () => ({ data: savedOfferRow, error: null }));
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "POST",
      body: {
        eyebrow: " Launch deal ",
        title: " Save 30% on Studio ",
        description: " Discount for the Studio plan. ",
        offerKind: "plan",
        discountLabel: " Save 30% ",
        targetLabel: " Studio monthly ",
        ctaLabel: " View plan ",
        ctaHref: "/pricing?plan=studio",
        displayOrder: "1",
        isActive: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eyebrow: "Launch deal",
        title: "Save 30% on Studio",
        offer_kind: "plan",
        cta_href: "/pricing?plan=studio",
        display_order: 1,
        created_by: "admin-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      offer: {
        id: "offer-1",
        eyebrow: "Launch deal",
        title: "Save 30% on Studio",
        description: "Discount for the Studio plan.",
        offerKind: "plan",
        discountLabel: "Save 30%",
        targetLabel: "Studio monthly",
        ctaLabel: "View plan",
        ctaHref: "/pricing?plan=studio",
        displayOrder: 1,
        isActive: true,
        startsAt: null,
        endsAt: null,
        createdAt: "2026-04-30T00:00:00.000Z",
        updatedAt: "2026-04-30T00:00:00.000Z",
      },
      message: "Offer saved and active.",
    });
  });
});
