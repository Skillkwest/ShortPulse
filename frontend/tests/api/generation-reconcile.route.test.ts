import { beforeEach, describe, expect, it, vi } from "vitest";
import generationReconcileHandler from "../../pages/api/generation/reconcile";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const reconcileVisibleGenerationsForUserMock = vi.fn();
const reconcileVisibleProjectGenerationsForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationReconcile", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/server/api/generationReconcile")>();
  return {
    ...actual,
    reconcileVisibleGenerationsForUser: (...args: unknown[]) =>
      reconcileVisibleGenerationsForUserMock(...args),
    reconcileVisibleProjectGenerationsForUser: (...args: unknown[]) =>
      reconcileVisibleProjectGenerationsForUserMock(...args),
  };
});

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/generation/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    reconcileVisibleGenerationsForUserMock.mockResolvedValue({
      reconciled: 1,
      recovered: 1,
      skipped: 0,
      failures: [],
    });
    reconcileVisibleProjectGenerationsForUserMock.mockResolvedValue({
      reconciled: 2,
      recovered: 1,
      skipped: 1,
      failures: [],
    });
  });

  it("rejects non-POST methods", async () => {
    const res = createMockResponse();

    await generationReconcileHandler({ method: "GET", body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(reconcileVisibleProjectGenerationsForUserMock).not.toHaveBeenCalled();
  });

  it("logs unexpected auth failures before reconcile starts", async () => {
    const res = createMockResponse();
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));

    await generationReconcileHandler(
      {
        method: "POST",
        body: { runtimeIdentities: [{ generationId: "gen-1" }] },
        headers: {},
      } as never,
      res as never
    );

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "generation.reconcile.auth",
        scope: "generation",
      })
    );
    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(reconcileVisibleProjectGenerationsForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to reconcile generation.",
    });
  });

  it("requires identities or projectId", async () => {
    const res = createMockResponse();

    await generationReconcileHandler({ method: "POST", body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid request",
      })
    );
    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(reconcileVisibleProjectGenerationsForUserMock).not.toHaveBeenCalled();
  });

  it("reconciles runtime identities for the authenticated owner", async () => {
    const res = createMockResponse();

    await generationReconcileHandler(
      {
        method: "POST",
        body: {
          runtimeIdentities: [{ generationId: "gen-1", requestId: "req-1", sourceRef: "source-1" }],
        },
      } as never,
      res as never
    );

    expect(reconcileVisibleGenerationsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      identities: [
        {
          generationId: "gen-1",
          requestId: "req-1",
          sourceRef: "source-1",
        },
      ],
    });
    expect(reconcileVisibleProjectGenerationsForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      reconciled: 1,
      recovered: 1,
      skipped: 0,
      failures: [],
    });
  });

  it("reconciles project-visible generations for the authenticated owner", async () => {
    const res = createMockResponse();

    await generationReconcileHandler(
      {
        method: "POST",
        body: {
          projectId: "project-1",
        },
      } as never,
      res as never
    );

    expect(reconcileVisibleProjectGenerationsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
