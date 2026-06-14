import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/generation/reconcile";

const requireApiUserMock = vi.fn();
const reconcileVisibleGenerationsForUserMock = vi.fn();
const reconcileVisibleProjectGenerationsForUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/generationReconcile", () => {
  const normalizeString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    normalizeGenerationReconcileIdentities: (value: unknown) =>
      (Array.isArray(value) ? value : [])
        .map((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
          const record = entry as Record<string, unknown>;
          const generationId = normalizeString(record.generationId);
          const requestId = normalizeString(record.requestId);
          const sourceRef = normalizeString(record.sourceRef);
          if (!generationId && !requestId && !sourceRef) return null;
          return { generationId, requestId, sourceRef };
        })
        .filter(Boolean),
    normalizeGenerationReconcileProjectId: (value: unknown) => normalizeString(value),
    reconcileVisibleGenerationsForUser: (...args: unknown[]) =>
      reconcileVisibleGenerationsForUserMock(...args),
    reconcileVisibleProjectGenerationsForUser: (...args: unknown[]) =>
      reconcileVisibleProjectGenerationsForUserMock(...args),
  };
});

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/generation/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    reconcileVisibleGenerationsForUserMock.mockResolvedValue({
      attempted: 1,
      results: [
        {
          generationId: "generation-1",
          requestId: "request-1",
          sourceRef: null,
          state: "recovered",
          ok: true,
          mediaFileIds: ["media-1"],
          mediaUrls: ["https://cdn.example.com/result.png"],
        },
      ],
    });
  });

  it("rejects non-POST requests", async () => {
    const req = { method: "GET", headers: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("requires at least one runtime identity", async () => {
    const req = { method: "POST", headers: {}, body: { runtimeIdentities: [] } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(reconcileVisibleGenerationsForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid request",
      })
    );
  });

  it("reconciles caller-owned runtime identities", async () => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer token" },
      body: {
        runtimeIdentities: [{ generationId: "generation-1", requestId: "request-1" }],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(reconcileVisibleGenerationsForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      identities: [{ generationId: "generation-1", requestId: "request-1", sourceRef: null }],
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        attempted: 1,
      })
    );
  });
});
