import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/sign-batch";

const requireApiUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../pages/api/_utils/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../pages/api/_utils/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../pages/api/_utils/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res;
};

describe("POST /api/media/sign-batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  it("signs a user-scoped path that contains ellipses in filename", async () => {
    const path = "user-1/private/images/example...file.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/signed" }],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: [path],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [path]: "https://example.test/signed",
      },
    });
  });

  it("rejects traversal-style segments while allowing valid requests", async () => {
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: ["user-1/private/../images/bad.png"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ urls: {} });
  });
});
