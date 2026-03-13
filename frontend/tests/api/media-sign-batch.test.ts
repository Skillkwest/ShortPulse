import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/sign-batch";

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

const createMockResponse = () => {
  const res = {
    setHeader: vi.fn().mockReturnThis(),
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
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/signed" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
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

    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 3600, undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [path]: "https://example.test/signed",
      },
    });
  });

  it("rejects traversal-style segments while allowing valid requests", async () => {
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/signed" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
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

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ urls: {} });
  });

  it("accepts reference-grid telemetry surface labels for cross-surface signing", async () => {
    const path = "user-1/upload/reference-card.png";
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/reference-signed" },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: [path],
        surface: "reference-grid",
        queryMode: "default",
        tab: "uploaded_images",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-sign-surface", "reference-grid");
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-sign-preview-profile", "none");
    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 3600, undefined);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("applies media-library panel transform profile for image paths", async () => {
    const path = "user-1/uploads/images/panel-image.jpg";
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/panel-signed" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: [path],
        surface: "media-library-panel",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith(
      "x-shortpulse-media-sign-preview-profile",
      "media-library-panel-image-card"
    );
    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 3600, {
      transform: {
        width: 512,
        quality: 50,
        resize: "contain",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
