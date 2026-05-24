import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/move-batch";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const moveMediaFileForUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/mediaMoveService", () => ({
  isMediaDataTab: (value: unknown) =>
    value === "private" ||
    value === "uploaded_images" ||
    value === "uploaded_videos" ||
    value === "saved_prompts" ||
    value === "ai_generations",
  moveMediaFileForUser: (...args: unknown[]) => moveMediaFileForUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createMoveSuccess = (fileId: string) => ({
  ok: true as const,
  value: {
    file: {
      id: fileId,
      user_id: "user-1",
      filename: `${fileId}.png`,
      storage_path: `user-1/private/images/${fileId}.png`,
      file_type: "image/png",
      source: "private_upload",
      source_ref: null,
      prompt_id: null,
      metadata: {},
      thumb_variant_path: null,
      poster_variant_path: null,
      preview_variant_path: null,
      created_at: "2026-05-10T00:00:00.000Z",
      updated_at: "2026-05-10T00:00:00.000Z",
    },
    fromTab: "uploaded_images" as const,
    toTab: "private" as const,
    previousStoragePath: `user-1/images/${fileId}.png`,
    nextStoragePath: `user-1/private/images/${fileId}.png`,
  },
});

describe("POST /api/media/move-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("moves multiple files with bounded concurrency while preserving response order", async () => {
    let activeMoves = 0;
    let maxActiveMoves = 0;

    moveMediaFileForUserMock.mockImplementation(
      async ({ fileId }: { fileId: string; destinationTab: string }) => {
        activeMoves += 1;
        maxActiveMoves = Math.max(maxActiveMoves, activeMoves);
        await new Promise((resolve) => setTimeout(resolve, fileId === "file-1" ? 20 : 0));
        activeMoves -= 1;
        if (fileId === "file-2") {
          return {
            ok: false as const,
            value: {
              error: "Move failed",
              details: "Destination rejected",
            },
          };
        }
        return createMoveSuccess(fileId);
      }
    );

    const req = {
      method: "POST",
      body: {
        destinationTab: "private",
        fileIds: ["file-1", "file-2", "file-3"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(moveMediaFileForUserMock).toHaveBeenCalledTimes(3);
    expect(maxActiveMoves).toBeGreaterThan(1);
    expect(res.json).toHaveBeenCalledWith({
      destinationTab: "private",
      moved: [
        {
          fileId: "file-1",
          ...createMoveSuccess("file-1").value,
        },
        {
          fileId: "file-3",
          ...createMoveSuccess("file-3").value,
        },
      ],
      failed: [
        {
          fileId: "file-2",
          error: "Move failed",
          details: "Destination rejected",
        },
      ],
      summary: {
        requested: 3,
        moved: 2,
        failed: 1,
      },
    });
  });

  it("returns 400 when required fields are missing", async () => {
    const req = {
      method: "POST",
      body: {
        destinationTab: "private",
        fileIds: [],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(moveMediaFileForUserMock).not.toHaveBeenCalled();
  });

  it("returns a sanitized 500 when batched media moves fail unexpectedly", async () => {
    moveMediaFileForUserMock.mockRejectedValueOnce(new Error("database exploded"));

    const req = {
      method: "POST",
      body: {
        destinationTab: "private",
        fileIds: ["file-1"],
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to move media files",
    });
  });

  it("rate limits repeated media move batches for the same authenticated user", async () => {
    moveMediaFileForUserMock.mockResolvedValue(createMoveSuccess("file-1"));

    for (let index = 0; index < 20; index += 1) {
      const req = {
        method: "POST",
        body: {
          destinationTab: "private",
          fileIds: ["file-1"],
        },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: {
        destinationTab: "private",
        fileIds: ["file-1"],
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
    expect(blockedRes.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
