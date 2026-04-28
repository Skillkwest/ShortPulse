import { beforeEach, describe, expect, it, vi } from "vitest";
import generationAbandonHandler from "../../pages/api/generation/abandon";

const requireApiUserMock = vi.fn();
const recordGenerationAbandonmentMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/generationAbandonment", () => ({
  recordGenerationAbandonment: (...args: unknown[]) => recordGenerationAbandonmentMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
});

describe("POST /api/generation/abandon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    recordGenerationAbandonmentMock.mockResolvedValue({
      abandonmentId: "abandon-1",
      matchedGenerationIds: ["gen-1"],
    });
  });

  it("rejects non-POST methods", async () => {
    const res = createMockResponse();

    await generationAbandonHandler({ method: "GET", body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(recordGenerationAbandonmentMock).not.toHaveBeenCalled();
  });

  it("requires at least one generation identifier", async () => {
    const res = createMockResponse();

    await generationAbandonHandler({ method: "POST", body: {} } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Invalid request",
      })
    );
    expect(recordGenerationAbandonmentMock).not.toHaveBeenCalled();
  });

  it("records a no-refund abandon marker for the authenticated owner", async () => {
    const res = createMockResponse();

    await generationAbandonHandler(
      {
        method: "POST",
        body: {
          output_id: "out-1",
          source_ref: "source-1",
          generation_id: "gen-1",
          request_id: "req-1",
        },
      } as never,
      res as never
    );

    expect(recordGenerationAbandonmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-1",
        generationId: "gen-1",
        requestId: "req-1",
        noRefund: true,
        metadata: expect.objectContaining({
          output_id: "out-1",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      matchedGenerationIds: ["gen-1"],
      cancelAttempted: false,
      cancelUnsupported: true,
    });
  });
});
