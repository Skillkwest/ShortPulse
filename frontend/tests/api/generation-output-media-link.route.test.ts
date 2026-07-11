/**
 * Route contract tests for server-authoritative generation output media linking.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/generation/output-media-link";

const requireApiUserMock = vi.fn();
const attachOwnedMediaFileMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));
vi.mock("../../lib/server/api/generationOutputs", () => ({
  attachOwnedMediaFileToGenerationOutput: (...args: unknown[]) => attachOwnedMediaFileMock(...args),
}));
vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/generation/output-media-link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    attachOwnedMediaFileMock.mockResolvedValue(undefined);
  });

  it("derives user ownership from the verified bearer identity", async () => {
    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: {
          generationId: "generation-1",
          mediaFileId: "media-1",
          outputIndex: 0,
          resultUrl: "https://provider.example/output.png",
          userId: "attacker-selected-user",
        },
      } as never,
      res as never
    );

    expect(attachOwnedMediaFileMock).toHaveBeenCalledWith({
      generationId: "generation-1",
      userId: "user-1",
      mediaFileId: "media-1",
      outputIndex: 0,
      resultUrl: "https://provider.example/output.png",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects malformed identifiers before the service-role mutation", async () => {
    const res = createResponse();
    await handler(
      {
        method: "POST",
        body: { generationId: "", mediaFileId: "media-1", outputIndex: -1 },
      } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(attachOwnedMediaFileMock).not.toHaveBeenCalled();
  });

  it("returns a non-enumerating not-found response for ownership failures", async () => {
    const res = createResponse();
    const error = new Error("ownership");
    error.name = "GenerationOutputOwnershipError";
    attachOwnedMediaFileMock.mockRejectedValueOnce(error);

    await handler(
      {
        method: "POST",
        body: { generationId: "foreign-generation", mediaFileId: "media-1", outputIndex: 0 },
      } as never,
      res as never
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Generation or media was not found." });
  });
});
