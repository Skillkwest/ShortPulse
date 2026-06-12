/**
 * API tests for public dashboard tutorial reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/dashboard/tutorials";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

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
const buildTutorialReadClient = (
  data: unknown[] | null,
  error: { message: string } | null = null
) => {
  const limitMock = vi.fn(async () => ({ data, error }));
  const orderUpdatedMock = vi.fn(() => ({ limit: limitMock }));
  const orderDisplayMock = vi.fn(() => ({ order: orderUpdatedMock }));
  const eqMock = vi.fn(() => ({ order: orderDisplayMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { client: { from: fromMock }, fromMock, eqMock, limitMock };
};

describe("GET /api/dashboard/tutorials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns active tutorial cards in dashboard shape", async () => {
    const { client, fromMock, eqMock } = buildTutorialReadClient([
      {
        id: "tutorial-1",
        title: "Create a project",
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
        thumbnail_alt: "Animated project creation preview",
        display_order: 1,
        is_active: true,
        created_at: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      },
    ]);
    getSupabaseAdminMock.mockReturnValue(client);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(fromMock).toHaveBeenCalledWith("dashboard_tutorials");
    expect(eqMock).toHaveBeenCalledWith("is_active", true);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      tutorials: [
        {
          id: "tutorial-1",
          title: "Create a project",
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
          thumbnailAlt: "Animated project creation preview",
          displayOrder: 1,
          isActive: true,
          createdAt: "2026-06-10T00:00:00.000Z",
          updatedAt: "2026-06-10T00:00:00.000Z",
        },
      ],
    });
  });

  it("falls back to legacy URL-only tutorial reads while storage columns are pending", async () => {
    const limitMock = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Could not find the 'thumbnail_storage_path' column in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "tutorial-1",
            title: "Create a project",
            youtube_url: "https://www.youtube.com/watch?v=abc123",
            thumbnail_url: "https://cdn.example.com/tutorial.gif",
            thumbnail_media_type: "image",
            thumbnail_alt: "Animated project creation preview",
            display_order: 1,
            is_active: true,
            created_at: "2026-06-10T00:00:00.000Z",
            updated_at: "2026-06-10T00:00:00.000Z",
          },
        ],
        error: null,
      });
    const orderUpdatedMock = vi.fn(() => ({ limit: limitMock }));
    const orderDisplayMock = vi.fn(() => ({ order: orderUpdatedMock }));
    const eqMock = vi.fn(() => ({ order: orderDisplayMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
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

  it("returns derivative display URLs for stored tutorial thumbnails", async () => {
    const { client } = buildTutorialReadClient([
      {
        id: "tutorial-1",
        title: "Create a project",
        youtube_url: "https://www.youtube.com/watch?v=abc123",
        thumbnail_url: null,
        thumbnail_storage_path: "tutorial-thumbnails/source.gif",
        thumbnail_file_size_bytes: 12345,
        thumbnail_content_type: "image/gif",
        thumbnail_media_type: "video",
        thumbnail_display_storage_path: "tutorial-thumbnail-variants/variant/display.mp4",
        thumbnail_display_file_size_bytes: 51234,
        thumbnail_display_content_type: "video/mp4",
        thumbnail_display_media_type: "video",
        thumbnail_poster_storage_path: "tutorial-thumbnail-variants/variant/poster.jpg",
        thumbnail_poster_file_size_bytes: 1234,
        thumbnail_poster_content_type: "image/jpeg",
        thumbnail_alt: "Animated project creation preview",
        display_order: 1,
        is_active: true,
        created_at: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      },
    ]);
    const createSignedUrlMock = vi.fn(async (path: string) => ({
      data: { signedUrl: `https://supabase.example.com/${path}` },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      ...client,
      storage: { from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "tutorial-thumbnail-variants/variant/display.mp4",
      86400
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "tutorial-thumbnail-variants/variant/poster.jpg",
      86400
    );
    expect(createSignedUrlMock).not.toHaveBeenCalledWith(
      "tutorial-thumbnails/source.gif",
      expect.any(Number)
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      tutorials: [
        expect.objectContaining({
          id: "tutorial-1",
          thumbnailUrl:
            "https://supabase.example.com/tutorial-thumbnail-variants/variant/display.mp4",
          thumbnailMediaType: "video",
          thumbnailDisplayStoragePath: "tutorial-thumbnail-variants/variant/display.mp4",
          thumbnailDisplayContentType: "video/mp4",
          thumbnailDisplayMediaType: "video",
          thumbnailPosterUrl:
            "https://supabase.example.com/tutorial-thumbnail-variants/variant/poster.jpg",
          thumbnailPosterStoragePath: "tutorial-thumbnail-variants/variant/poster.jpg",
        }),
      ],
    });
  });

  it("allows public dashboard reads without a bearer session", async () => {
    const { client } = buildTutorialReadClient([]);
    getSupabaseAdminMock.mockReturnValue(client);

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ tutorials: [] });
  });
});
