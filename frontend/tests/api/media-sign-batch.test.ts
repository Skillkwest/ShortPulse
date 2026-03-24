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
    vi.unstubAllEnvs();
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
          createSignedUrl: vi.fn(),
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

  it("rejects non-POST methods", async () => {
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("rejects traversal-style segments while allowing valid requests", async () => {
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path: "user-1/private/images/good.png", signedUrl: "https://example.test/signed" }],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
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

  it("accepts reference-grid telemetry surface labels for cross-surface signing", async () => {
    const path = "user-1/upload/reference-card.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/reference-signed" }],
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
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
    expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("keeps panel image signing untransformed when dual transform flags are off", async () => {
    const path = "user-1/uploads/images/panel-image.jpg";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/panel-signed" }],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
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
    expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("applies panel image transforms when both transform flags are enabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

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

    expect(createSignedUrlMock).toHaveBeenCalledWith(path, 3600, {
      transform: {
        width: 512,
        quality: 50,
        resize: "contain",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("batches untransformed paths and still signs transformed image paths individually", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

    const videoPath = "user-1/uploads/videos/panel-video.mp4";
    const imagePath = "user-1/uploads/images/panel-image.jpg";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path: videoPath, signedUrl: "https://example.test/panel-video-signed" }],
      error: null,
    }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/panel-image-signed" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: [videoPath, imagePath],
        surface: "media-library-panel",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledWith([videoPath], 3600);
    expect(createSignedUrlMock).toHaveBeenCalledWith(imagePath, 3600, {
      transform: {
        width: 512,
        quality: 50,
        resize: "contain",
      },
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [videoPath]: "https://example.test/panel-video-signed",
        [imagePath]: "https://example.test/panel-image-signed",
      },
    });
  });

  it("does not apply transforms to profile-none surfaces even when transform flags are enabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

    const path = "user-1/uploads/images/reference-card.jpg";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/reference-signed" }],
      error: null,
    }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://example.test/reference-signed" },
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
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
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects paths outside the authenticated user scope", async () => {
    const createSignedUrlMock = vi.fn();
    const createSignedUrlsMock = vi.fn();
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: ["user-2/private/images/not-allowed.png"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("logs invalid JSON body parse failures and returns 500", async () => {
    const req = {
      method: "POST",
      body: "{invalid json",
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to sign media paths",
      details: expect.stringContaining("JSON"),
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "media-sign-batch",
      })
    );
  });
});
