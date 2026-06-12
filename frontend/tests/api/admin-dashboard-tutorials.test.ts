/**
 * API tests for admin-managed signed-in dashboard tutorials.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/dashboard/tutorials";

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

const savedTutorialRow = {
  id: "tutorial-1",
  title: "Create your first project",
  youtube_url: "https://www.youtube.com/watch?v=abc123",
  thumbnail_url: "https://cdn.example.com/tutorial.gif",
  thumbnail_storage_path: null,
  thumbnail_file_size_bytes: null,
  thumbnail_content_type: null,
  thumbnail_media_type: "image",
  thumbnail_display_storage_path: null,
  thumbnail_display_file_size_bytes: null,
  thumbnail_display_content_type: null,
  thumbnail_display_media_type: null,
  thumbnail_poster_storage_path: null,
  thumbnail_poster_file_size_bytes: null,
  thumbnail_poster_content_type: null,
  thumbnail_alt: "Animated dashboard tutorial preview",
  display_order: 1,
  is_active: true,
  created_at: "2026-06-10T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
};

describe("/api/admin/dashboard/tutorials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects unsupported methods", async () => {
    const req = { method: "PUT", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, POST, PATCH, DELETE");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("rejects non-YouTube tutorial destinations", async () => {
    const req = {
      method: "POST",
      body: {
        title: "Bad destination",
        youtubeUrl: "https://example.com/watch",
        thumbnailUrl: "https://cdn.example.com/tutorial.gif",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "YouTube URL must be an HTTPS youtube.com or youtu.be link.",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("creates a normalized dashboard tutorial", async () => {
    const maybeSingleMock = vi.fn(async () => ({ data: savedTutorialRow, error: null }));
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = {
      method: "POST",
      body: {
        title: " Create your first project ",
        youtubeUrl: " https://www.youtube.com/watch?v=abc123 ",
        thumbnailUrl: " https://cdn.example.com/tutorial.gif ",
        thumbnailMediaType: "image",
        thumbnailAlt: " Animated dashboard tutorial preview ",
        displayOrder: "1",
        isActive: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Create your first project",
        youtube_url: "https://www.youtube.com/watch?v=abc123",
        thumbnail_url: "https://cdn.example.com/tutorial.gif",
        thumbnail_media_type: "image",
        display_order: 1,
        created_by: "admin-1",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      tutorial: {
        id: "tutorial-1",
        title: "Create your first project",
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://cdn.example.com/tutorial.gif",
        thumbnailStoragePath: null,
        thumbnailFileSizeBytes: null,
        thumbnailContentType: null,
        thumbnailMediaType: "image",
        thumbnailDisplayStoragePath: null,
        thumbnailDisplayFileSizeBytes: null,
        thumbnailDisplayContentType: null,
        thumbnailDisplayMediaType: null,
        thumbnailPosterUrl: null,
        thumbnailPosterStoragePath: null,
        thumbnailPosterFileSizeBytes: null,
        thumbnailPosterContentType: null,
        thumbnailAlt: "Animated dashboard tutorial preview",
        displayOrder: 1,
        isActive: true,
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      message: "Tutorial saved and active.",
    });
  });

  it("loads the admin tutorial catalog through the legacy URL-only schema when storage columns are pending", async () => {
    const limitMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: "column dashboard_tutorials.thumbnail_storage_path does not exist",
        },
      })
      .mockResolvedValueOnce({ data: [savedTutorialRow], error: null });
    const orderUpdatedMock = vi.fn(() => ({ limit: limitMock }));
    const orderDisplayMock = vi.fn(() => ({ order: orderUpdatedMock }));
    const selectMock = vi.fn(() => ({ order: orderDisplayMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(selectMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("thumbnail_storage_path")
    );
    expect(selectMock).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining("thumbnail_storage_path")
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      tutorials: [
        expect.objectContaining({
          id: "tutorial-1",
          thumbnailUrl: "https://cdn.example.com/tutorial.gif",
          thumbnailStoragePath: null,
        }),
      ],
    });
  });

  it("stores uploaded thumbnail paths instead of temporary signed URLs", async () => {
    const storedTutorialRow = {
      ...savedTutorialRow,
      thumbnail_url: null,
      thumbnail_storage_path: "tutorial-thumbnails/uploaded.gif",
      thumbnail_file_size_bytes: 12345,
      thumbnail_content_type: "image/gif",
      thumbnail_media_type: "video",
      thumbnail_display_storage_path: "tutorial-thumbnail-variants/uploaded/display.mp4",
      thumbnail_display_file_size_bytes: 23456,
      thumbnail_display_content_type: "video/mp4",
      thumbnail_display_media_type: "video",
      thumbnail_poster_storage_path: "tutorial-thumbnail-variants/uploaded/poster.jpg",
      thumbnail_poster_file_size_bytes: 3456,
      thumbnail_poster_content_type: "image/jpeg",
    };
    const maybeSingleMock = vi.fn(async () => ({ data: storedTutorialRow, error: null }));
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://supabase.example.com/signed-uploaded.gif" },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({ createSignedUrl: createSignedUrlMock }));
    getSupabaseAdminMock.mockReturnValue({
      from: fromMock,
      storage: { from: storageFromMock },
    });

    const req = {
      method: "POST",
      body: {
        title: "Create your first project",
        youtubeUrl: "https://www.youtube.com/watch?v=abc123",
        thumbnailUrl: "https://supabase.example.com/temporary-signed.gif",
        thumbnailStoragePath: "tutorial-thumbnails/uploaded.gif",
        thumbnailFileSizeBytes: 12345,
        thumbnailContentType: "image/gif",
        thumbnailMediaType: "video",
        thumbnailDisplayStoragePath: "tutorial-thumbnail-variants/uploaded/display.mp4",
        thumbnailDisplayFileSizeBytes: 23456,
        thumbnailDisplayContentType: "video/mp4",
        thumbnailDisplayMediaType: "video",
        thumbnailPosterStoragePath: "tutorial-thumbnail-variants/uploaded/poster.jpg",
        thumbnailPosterFileSizeBytes: 3456,
        thumbnailPosterContentType: "image/jpeg",
        displayOrder: 1,
        isActive: true,
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnail_url: null,
        thumbnail_storage_path: "tutorial-thumbnails/uploaded.gif",
        thumbnail_file_size_bytes: 12345,
        thumbnail_content_type: "image/gif",
        thumbnail_display_storage_path: "tutorial-thumbnail-variants/uploaded/display.mp4",
        thumbnail_display_file_size_bytes: 23456,
        thumbnail_display_content_type: "video/mp4",
        thumbnail_display_media_type: "video",
        thumbnail_poster_storage_path: "tutorial-thumbnail-variants/uploaded/poster.jpg",
        thumbnail_poster_file_size_bytes: 3456,
        thumbnail_poster_content_type: "image/jpeg",
      })
    );
    expect(storageFromMock).toHaveBeenCalledWith("dashboard_tutorial_thumbnails");
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "tutorial-thumbnail-variants/uploaded/display.mp4",
      86400
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      tutorial: expect.objectContaining({
        thumbnailUrl: "https://supabase.example.com/signed-uploaded.gif",
        thumbnailStoragePath: "tutorial-thumbnails/uploaded.gif",
        thumbnailFileSizeBytes: 12345,
        thumbnailContentType: "image/gif",
        thumbnailDisplayStoragePath: "tutorial-thumbnail-variants/uploaded/display.mp4",
        thumbnailPosterStoragePath: "tutorial-thumbnail-variants/uploaded/poster.jpg",
      }),
      message: "Tutorial saved and active.",
    });
  });

  it("rejects duplicate tutorial reorder ids", async () => {
    const req = { method: "PATCH", body: { ids: ["tutorial-1", "tutorial-1"] } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Unique tutorial ids are required." });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("persists tutorial reorder ids through the reorder RPC", async () => {
    const rpcMock = vi.fn(async () => ({
      data: [
        { ...savedTutorialRow, id: "tutorial-2", display_order: 1 },
        { ...savedTutorialRow, id: "tutorial-1", display_order: 2 },
      ],
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "PATCH", body: { ids: ["tutorial-2", "tutorial-1"] } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("reorder_dashboard_tutorials", {
      p_ids: ["tutorial-2", "tutorial-1"],
      p_actor_user_id: "admin-1",
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
