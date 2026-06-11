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
  thumbnail_media_type: "image",
  thumbnail_alt: "Animated dashboard tutorial preview",
  display_order: 1,
  is_active: true,
  created_at: "2026-06-10T00:00:00.000Z",
  updated_at: "2026-06-10T00:00:00.000Z",
};

const buildAdminReadClient = (data = [savedTutorialRow]) => {
  const limitMock = vi.fn(async () => ({ data, error: null }));
  const orderUpdatedMock = vi.fn(() => ({ limit: limitMock }));
  const orderDisplayMock = vi.fn(() => ({ order: orderUpdatedMock }));
  const selectMock = vi.fn(() => ({ order: orderDisplayMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { from: fromMock };
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
        thumbnailMediaType: "image",
        thumbnailAlt: "Animated dashboard tutorial preview",
        displayOrder: 1,
        isActive: true,
        createdAt: "2026-06-10T00:00:00.000Z",
        updatedAt: "2026-06-10T00:00:00.000Z",
      },
      message: "Tutorial saved and active.",
    });
  });

  it("persists tutorial reorder ids", async () => {
    const updateMock = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
    const fromMock = vi.fn(() => ({
      update: updateMock,
      select: buildAdminReadClient([
        { ...savedTutorialRow, id: "tutorial-2", display_order: 1 },
        { ...savedTutorialRow, id: "tutorial-1", display_order: 2 },
      ]).from().select,
    }));
    getSupabaseAdminMock.mockReturnValue({ from: fromMock });

    const req = { method: "PATCH", body: { ids: ["tutorial-2", "tutorial-1"] } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(updateMock).toHaveBeenCalledWith({ display_order: 1, updated_by: "admin-1" });
    expect(updateMock).toHaveBeenCalledWith({ display_order: 2, updated_by: "admin-1" });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
