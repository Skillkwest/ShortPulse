/**
 * Admin Legal API tests.
 * Verifies auth, slug validation, list/detail reads, and stale-safe publication behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import listHandler from "../../pages/api/admin/legal/policies";
import detailHandler from "../../pages/api/admin/legal/policies/[slug]";
import publishHandler from "../../pages/api/admin/legal/policies/[slug]/publish";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const listLegalPoliciesForAdminMock = vi.fn();
const resolveLegalPolicyForAdminMock = vi.fn();
const publishLegalPolicyMock = vi.fn();
const staleError = new Error("stale");
staleError.name = "LegalPolicyVersionMismatchError";

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/legalPolicyControlPlane", () => ({
  LegalPolicyVersionMismatchError: class LegalPolicyVersionMismatchError extends Error {},
  listLegalPoliciesForAdmin: (...args: unknown[]) => listLegalPoliciesForAdminMock(...args),
  resolveLegalPolicyForAdmin: (...args: unknown[]) => resolveLegalPolicyForAdminMock(...args),
  publishLegalPolicy: (...args: unknown[]) => publishLegalPolicyMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const activeTermsPolicy = {
  slug: "terms",
  markdown: "# ShortPulse Terms of Service\n\nLast updated: June 21, 2026\n",
  version: 2,
  versionId: 12,
  note: "June update",
  source: "control_plane",
  updatedAt: "2026-06-21T18:00:00.000Z",
  updatedByEmail: "admin@example.com",
  degraded: false,
  history: [],
};

describe("admin legal policy APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("lists legal policy documents for admins", async () => {
    listLegalPoliciesForAdminMock.mockResolvedValue([activeTermsPolicy]);

    const req = { method: "GET" };
    const res = createMockResponse();
    await listHandler(req as never, res as never);

    expect(listLegalPoliciesForAdminMock).toHaveBeenCalledWith();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store, max-age=0");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ policies: [activeTermsPolicy] });
  });

  it("rejects non-GET list requests", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();
    await listHandler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("loads a single legal policy by slug", async () => {
    resolveLegalPolicyForAdminMock.mockResolvedValue(activeTermsPolicy);

    const req = { method: "GET", query: { slug: "terms" } };
    const res = createMockResponse();
    await detailHandler(req as never, res as never);

    expect(resolveLegalPolicyForAdminMock).toHaveBeenCalledWith({ slug: "terms" });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ policy: activeTermsPolicy });
  });

  it("rejects invalid legal policy slugs before auth", async () => {
    const req = { method: "GET", query: { slug: "cookie-policy" } };
    const res = createMockResponse();
    await detailHandler(req as never, res as never);

    expect(requireAdminUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid legal policy slug." });
  });

  it("publishes a new legal policy version", async () => {
    publishLegalPolicyMock.mockResolvedValue({
      ...activeTermsPolicy,
      markdown: "# ShortPulse Terms of Service\n\nLast updated: June 22, 2026\n",
      version: 3,
    });

    const req = {
      method: "POST",
      query: { slug: "terms" },
      body: {
        markdown: " # ShortPulse Terms of Service\n\nLast updated: June 22, 2026 ",
        expectedUpdatedAt: "2026-06-21T18:00:00.000Z",
        note: " Owner-approved wording ",
      },
    };
    const res = createMockResponse();
    await publishHandler(req as never, res as never);

    expect(publishLegalPolicyMock).toHaveBeenCalledWith({
      slug: "terms",
      markdown: "# ShortPulse Terms of Service\n\nLast updated: June 22, 2026\n",
      expectedUpdatedAt: "2026-06-21T18:00:00.000Z",
      note: "Owner-approved wording",
      actorUserId: "admin-1",
      actorEmail: "admin@example.com",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      policy: {
        ...activeTermsPolicy,
        markdown: "# ShortPulse Terms of Service\n\nLast updated: June 22, 2026\n",
        version: 3,
      },
    });
  });

  it("requires stale-write tokens for publication", async () => {
    const req = {
      method: "POST",
      query: { slug: "terms" },
      body: { markdown: "# Terms" },
    };
    const res = createMockResponse();
    await publishHandler(req as never, res as never);

    expect(publishLegalPolicyMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "expectedUpdatedAt is required so stale legal policy drafts cannot overwrite the active document.",
    });
  });

  it("returns 409 when the active legal policy changed", async () => {
    publishLegalPolicyMock.mockRejectedValue(staleError);

    const req = {
      method: "POST",
      query: { slug: "terms" },
      body: {
        markdown: "# Terms",
        expectedUpdatedAt: "2026-06-21T18:00:00.000Z",
      },
    };
    const res = createMockResponse();
    await publishHandler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      code: "LEGAL_POLICY_STALE",
      error: "This legal policy changed since you loaded it. Refresh and try again.",
    });
  });
});
