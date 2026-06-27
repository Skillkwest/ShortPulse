import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/delete";

const requireApiUserMock = vi.fn();
const deleteMediaFileForUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/mediaLibraryDeleteService", () => ({
  deleteMediaFileForUser: (...args: unknown[]) => deleteMediaFileForUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/media/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
    deleteMediaFileForUserMock.mockResolvedValue({
      deletedMediaId: "media-1",
      deletedStoragePaths: ["user-1/generations/audio/gen-1/audio.mp3"],
      cleanedGeneratedAudioCompanionArt: true,
    });
  });

  it("rejects non-POST methods before auth or service work", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(requireApiUserMock).not.toHaveBeenCalled();
    expect(deleteMediaFileForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe failure when auth verification throws", async () => {
    const authError = new Error("auth verifier failed");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const req = { method: "POST", body: { mediaFileId: "media-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "media-delete.auth",
      })
    );
    expect(deleteMediaFileForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete media" });
  });

  it("rejects missing media ids", async () => {
    const req = { method: "POST", body: { mediaFileId: "   " } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteMediaFileForUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing required fields" });
  });

  it("deletes caller-owned media through the server service", async () => {
    const req = { method: "POST", body: JSON.stringify({ mediaFileId: "media-1" }) };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(deleteMediaFileForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      mediaFileId: "media-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      deletedMediaId: "media-1",
      deletedStoragePaths: ["user-1/generations/audio/gen-1/audio.mp3"],
      cleanedGeneratedAudioCompanionArt: true,
    });
  });

  it("logs and returns service failures with details", async () => {
    const deleteError = new Error("Unable to delete media.");
    deleteMediaFileForUserMock.mockRejectedValueOnce(deleteError);
    const req = { method: "POST", body: { mediaFileId: "media-1" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: deleteError,
        routeLabel: "media-delete",
        user: { id: "user-1" },
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to delete media",
      details: "Unable to delete media.",
    });
  });
});
