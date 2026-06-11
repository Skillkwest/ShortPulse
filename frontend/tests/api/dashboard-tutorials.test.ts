/**
 * API tests for signed-in dashboard tutorial reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/dashboard/tutorials";

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

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});
type MockResponse = ReturnType<typeof createMockResponse>;

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
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
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
          thumbnailAlt: "Animated project creation preview",
          displayOrder: 1,
          isActive: true,
          createdAt: "2026-06-10T00:00:00.000Z",
          updatedAt: "2026-06-10T00:00:00.000Z",
        },
      ],
    });
  });

  it("returns 401 when caller is unauthenticated", async () => {
    requireApiUserMock.mockImplementationOnce(async (_req: unknown, res: MockResponse) => {
      res.status(401).json({ error: "Unauthorized" });
      return null;
    });

    const req = { method: "GET" };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });
});
