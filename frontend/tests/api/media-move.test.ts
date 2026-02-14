import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/move";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

type TestMediaFile = {
  id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  file_type: string;
  source: string;
  source_ref: string | null;
  prompt_id: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
  created_at: string;
  updated_at: string;
};

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

const createBaseFile = (overrides?: Partial<TestMediaFile>): TestMediaFile => ({
  id: "file-1",
  user_id: "user-1",
  filename: "sample.jpg",
  storage_path: "user-1/images/sample.jpg",
  file_type: "image",
  source: "upload",
  source_ref: null,
  prompt_id: null,
  metadata: {},
  thumb_variant_path: null,
  poster_variant_path: null,
  preview_variant_path: null,
  created_at: "2026-02-01T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

const setupSupabaseAdminMock = ({
  fileRow,
  updateError,
  fileError,
  moveResults,
}: {
  fileRow: TestMediaFile;
  updateError?: { message: string } | null;
  fileError?: { message: string } | null;
  moveResults?: Array<{ error: { message: string } | null }>;
}) => {
  let updateValues: Record<string, unknown> | null = null;

  const moveQueue = [...(moveResults ?? [{ error: null }])];
  const moveMock = vi.fn(async () => moveQueue.shift() ?? { error: null });
  const storageFromMock = vi.fn(() => ({ move: moveMock }));

  const firstSelectMaybeSingleMock = vi.fn(async () => ({
    data: fileRow,
    error: fileError ?? null,
  }));

  const updateSelectMaybeSingleMock = vi.fn(async () => {
    if (updateError) {
      return {
        data: null,
        error: updateError,
      };
    }
    return {
      data: {
        ...fileRow,
        source: String(updateValues?.source ?? fileRow.source),
        storage_path: String(updateValues?.storage_path ?? fileRow.storage_path),
        updated_at: String(updateValues?.updated_at ?? fileRow.updated_at),
      },
      error: null,
    };
  });

  const mediaFilesBuilder = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: firstSelectMaybeSingleMock,
        })),
      })),
    })),
    update: vi.fn((values: Record<string, unknown>) => {
      updateValues = values;
      return {
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              maybeSingle: updateSelectMaybeSingleMock,
            })),
          })),
        })),
      };
    }),
  };

  const mediaEventsInsertMock = vi.fn(async () => ({ error: null }));
  const mediaEventsBuilder = {
    insert: mediaEventsInsertMock,
  };

  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") return mediaFilesBuilder;
    if (table === "media_events") return mediaEventsBuilder;
    throw new Error(`Unexpected table: ${table}`);
  });

  getSupabaseAdminMock.mockReturnValue({
    from: fromMock,
    storage: {
      from: storageFromMock,
    },
  });

  return {
    fromMock,
    storageFromMock,
    moveMock,
    mediaFilesBuilder,
    mediaEventsInsertMock,
  };
};

describe("POST /api/media/move", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("moves media to a valid destination and returns 200", async () => {
    const fileRow = createBaseFile();
    const { moveMock, mediaFilesBuilder, mediaEventsInsertMock } = setupSupabaseAdminMock({
      fileRow,
    });

    const req = {
      method: "POST",
      body: {
        fileId: "file-1",
        destinationTab: "private",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(moveMock).toHaveBeenCalledTimes(1);
    const moveCalls = moveMock.mock.calls as Array<unknown[]>;
    const fromPath = String(moveCalls[0]?.[0] ?? "");
    const toPath = String(moveCalls[0]?.[1] ?? "");
    expect(fromPath).toBe("user-1/images/sample.jpg");
    expect(toPath.startsWith("user-1/private/images/")).toBe(true);

    expect(mediaFilesBuilder.update).toHaveBeenCalledTimes(1);
    const updatePayload = mediaFilesBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updatePayload.source).toBe("private_upload");
    expect(String(updatePayload.storage_path).startsWith("user-1/private/images/")).toBe(true);

    expect(mediaEventsInsertMock).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        fromTab: "uploaded_images",
        toTab: "private",
      })
    );
  });

  it("returns 400 for valid tab that fails move validation", async () => {
    const fileRow = createBaseFile({
      filename: "clip.mp4",
      file_type: "video/mp4",
      storage_path: "user-1/videos/clip.mp4",
    });
    const { moveMock } = setupSupabaseAdminMock({ fileRow });

    const req = {
      method: "POST",
      body: {
        fileId: "file-1",
        destinationTab: "private",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid move destination" })
    );
    expect(moveMock).not.toHaveBeenCalled();
  });

  it("returns early when requireApiUser rejects the request", async () => {
    requireApiUserMock.mockImplementation(
      async (_req: unknown, res: { status: (s: number) => { json: (p: unknown) => unknown } }) => {
        res.status(401).json({ error: "Unauthorized" });
        return null;
      }
    );

    const req = {
      method: "POST",
      body: {
        fileId: "file-1",
        destinationTab: "private",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("attempts storage rollback when metadata update fails", async () => {
    const fileRow = createBaseFile();
    const { moveMock } = setupSupabaseAdminMock({
      fileRow,
      updateError: { message: "Update failed" },
      moveResults: [{ error: null }, { error: null }],
    });

    const req = {
      method: "POST",
      body: {
        fileId: "file-1",
        destinationTab: "private",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Failed to update media metadata",
        details: "Update failed",
      })
    );
    expect(moveMock).toHaveBeenCalledTimes(2);

    const moveCalls = moveMock.mock.calls as Array<unknown[]>;
    const firstFrom = String(moveCalls[0]?.[0] ?? "");
    const firstTo = String(moveCalls[0]?.[1] ?? "");
    const secondFrom = String(moveCalls[1]?.[0] ?? "");
    const secondTo = String(moveCalls[1]?.[1] ?? "");
    expect(secondFrom).toBe(firstTo);
    expect(secondTo).toBe(firstFrom);
  });
});
