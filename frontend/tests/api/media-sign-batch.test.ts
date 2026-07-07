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
  const res: {
    statusCode: number;
    setHeader: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  } = {
    statusCode: 200,
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
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

  it("does not sign stale variant paths when storage metadata shows the object is missing", async () => {
    const staleThumbPath = "user-1/variants/images/media-1/thumb_480";
    const originalPath = "user-1/uploads/images/media-1.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path: originalPath, signedUrl: "https://example.test/original-signed" }],
      error: null,
    }));
    const storageObjectsInMock = vi.fn(async () => ({
      data: [{ name: originalPath }],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: storageObjectsInMock,
            })),
          })),
        })),
      })),
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
        paths: [staleThumbPath, originalPath],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(storageObjectsInMock).toHaveBeenCalledWith("name", [staleThumbPath, originalPath]);
    expect(createSignedUrlsMock).toHaveBeenCalledWith([originalPath], 3600);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [staleThumbPath]: null,
        [originalPath]: "https://example.test/original-signed",
      },
    });
  });

  it("falls back to bucket listing when storage metadata verification is unavailable", async () => {
    const path = "user-1/uploads/images/media-1.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/fallback-signed" }],
      error: null,
    }));
    const storageObjectsInMock = vi.fn(async () => ({
      data: null,
      error: { message: "storage metadata unavailable" },
    }));
    const listMock = vi.fn(async () => ({
      data: [{ name: "media-1.png" }],
      error: null,
    }));

    getSupabaseAdminMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: storageObjectsInMock,
            })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
          list: listMock,
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

    expect(storageObjectsInMock).toHaveBeenCalledWith("name", [path]);
    expect(listMock).toHaveBeenCalledWith("user-1/uploads/images", {
      limit: 100,
      search: "media-1.png",
    });
    expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [path]: "https://example.test/fallback-signed",
      },
    });
  });

  it("bounds bucket-list fallback fanout when storage metadata verification is unavailable", async () => {
    const paths = Array.from(
      { length: 8 },
      (_value, index) => `user-1/uploads/images/media-${index + 1}.png`
    );
    const createSignedUrlsMock = vi.fn(async (signPaths: string[]) => ({
      data: signPaths.map((path) => ({
        path,
        signedUrl: `https://example.test/${path.split("/").pop() ?? "media"}`,
      })),
      error: null,
    }));
    const storageObjectsInMock = vi.fn(async () => ({
      data: null,
      error: { message: "storage metadata unavailable" },
    }));
    let activeListCalls = 0;
    let maxActiveListCalls = 0;
    const pendingListResolves: Array<() => void> = [];
    const listMock = vi.fn(
      async (_folder: string, options?: { limit?: number; search?: string }) => {
        activeListCalls += 1;
        maxActiveListCalls = Math.max(maxActiveListCalls, activeListCalls);
        await new Promise<void>((resolve) => {
          pendingListResolves.push(resolve);
        });
        activeListCalls -= 1;
        return {
          data: [{ name: options?.search }],
          error: null,
        };
      }
    );

    getSupabaseAdminMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: storageObjectsInMock,
            })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
          list: listMock,
        })),
      },
    });

    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths,
      },
    };
    const res = createMockResponse();
    const responsePromise = handler(req as never, res as never);

    for (let attempts = 0; pendingListResolves.length < 4 && attempts < 10; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(listMock).toHaveBeenCalledTimes(4);
    expect(pendingListResolves).toHaveLength(4);
    expect(maxActiveListCalls).toBe(4);

    pendingListResolves.splice(0).forEach((resolve) => resolve());
    for (let attempts = 0; pendingListResolves.length < 4 && attempts < 10; attempts += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(listMock).toHaveBeenCalledTimes(8);
    expect(pendingListResolves).toHaveLength(4);
    expect(maxActiveListCalls).toBe(4);

    pendingListResolves.splice(0).forEach((resolve) => resolve());
    await responsePromise;

    expect(storageObjectsInMock).toHaveBeenCalledWith("name", paths);
    expect(createSignedUrlsMock).toHaveBeenCalledWith(paths, 3600);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns null without signing when storage metadata verification fails", async () => {
    const path = "user-1/uploads/images/media-1.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/should-not-sign" }],
      error: null,
    }));
    const storageObjectsInMock = vi.fn(async () => ({
      data: null,
      error: { message: "storage metadata unavailable" },
    }));

    getSupabaseAdminMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: storageObjectsInMock,
            })),
          })),
        })),
      })),
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

    expect(storageObjectsInMock).toHaveBeenCalledWith("name", [path]);
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [path]: null,
      },
    });
  });

  it("returns null without signing when storage list fallback times out", async () => {
    const path = "user-1/uploads/images/media-1.png";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [{ path, signedUrl: "https://example.test/should-not-sign" }],
      error: null,
    }));
    const storageObjectsInMock = vi.fn(async () => ({
      data: null,
      error: { message: "storage metadata unavailable" },
    }));
    const listMock = vi.fn(async () => {
      throw new Error("Gateway Timeout");
    });

    getSupabaseAdminMock.mockReturnValue({
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: storageObjectsInMock,
            })),
          })),
        })),
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUrls: createSignedUrlsMock,
          createSignedUrl: vi.fn(),
          list: listMock,
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

    expect(storageObjectsInMock).toHaveBeenCalledWith("name", [path]);
    expect(listMock).toHaveBeenCalledWith("user-1/uploads/images", {
      limit: 100,
      search: "media-1.png",
    });
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [path]: null,
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

  it("logs auth verifier failures before storage signing", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: ["user-1/private/images/example.png"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: expect.any(Error),
        routeLabel: "media-sign-batch.auth",
        scope: "app",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to sign media paths",
    });
  });

  it("logs controlled auth verification outages before returning", async () => {
    requireApiUserMock.mockImplementationOnce(
      async (_req: unknown, res: { statusCode: number }) => {
        res.statusCode = 503;
        return null;
      }
    );
    const req = {
      method: "POST",
      body: {
        bucket: "media_library",
        paths: ["user-1/private/images/example.png"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "media-sign-batch.auth",
        scope: "app",
        metadata: expect.objectContaining({
          reason_code: "AUTH_VERIFICATION_UNAVAILABLE",
        }),
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
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

  it.each(["media-library-panel", "elements-media-panel"] as const)(
    "keeps %s image signing untransformed when dual transform flags are off",
    async (surface) => {
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
          surface,
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
    }
  );

  it.each(["media-library-panel", "elements-media-panel"] as const)(
    "keeps %s image signing untransformed even when legacy transform flags are enabled",
    async (surface) => {
      vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
      vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

      const path = "user-1/uploads/images/panel-image.jpg";
      const createSignedUrlsMock = vi.fn(async () => ({
        data: [{ path, signedUrl: "https://example.test/panel-signed" }],
        error: null,
      }));
      const createSignedUrlMock = vi.fn(async () => ({
        data: { signedUrl: "https://example.test/panel-signed" },
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
          surface,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(createSignedUrlsMock).toHaveBeenCalledWith([path], 3600);
      expect(createSignedUrlMock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    }
  );

  it("batches mixed media paths without transform-backed individual signing", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
    vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

    const videoPath = "user-1/uploads/videos/panel-video.mp4";
    const imagePath = "user-1/uploads/images/panel-image.jpg";
    const createSignedUrlsMock = vi.fn(async () => ({
      data: [
        { path: videoPath, signedUrl: "https://example.test/panel-video-signed" },
        { path: imagePath, signedUrl: "https://example.test/panel-image-signed" },
      ],
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

    expect(createSignedUrlsMock).toHaveBeenCalledWith([videoPath, imagePath], 3600);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
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
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "media-sign-batch",
      })
    );
  });
});
