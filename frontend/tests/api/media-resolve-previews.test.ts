import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/resolve-previews";

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

type MediaLookupRow = {
  id: string;
  user_id: string;
  filename: string | null;
  storage_path: string | null;
  file_type: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
};

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createRow = (overrides?: Partial<MediaLookupRow>): MediaLookupRow => ({
  id: "media-1",
  user_id: "user-1",
  filename: "sample.jpg",
  storage_path: "user-1/images/sample.jpg",
  file_type: "image",
  metadata: {},
  thumb_variant_path: null,
  poster_variant_path: null,
  preview_variant_path: null,
  ...overrides,
});

const setupSupabaseAdmin = ({
  rows,
  existingObjectNames,
  basenameMatches,
  signedUrlsByPath,
}: {
  rows: MediaLookupRow[];
  existingObjectNames: string[];
  basenameMatches?: Record<string, string | null>;
  signedUrlsByPath?: Record<string, string>;
}) => {
  let capturedInNames: string[] = [];
  const ilikePatterns: string[] = [];
  const createSignedUrlMock = vi.fn(async (path: string) => ({
    data: {
      signedUrl:
        signedUrlsByPath?.[path] ?? `https://example.test/signed/${encodeURIComponent(path)}`,
    },
    error: null,
  }));

  const mediaFilesFromMock = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(async () => ({
          data: rows,
          error: null,
        })),
      })),
    })),
  };

  const ilikeMock = vi.fn((_column: string, pattern: string) => {
    ilikePatterns.push(pattern);
    return {
      limit: vi.fn(async () => ({
        data: (() => {
          const match = basenameMatches?.[pattern] ?? null;
          return match ? [{ name: match }] : [];
        })(),
        error: null,
      })),
    };
  });

  const storageObjectsFromMock = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(async (_column: string, names: string[]) => {
          capturedInNames = names;
          return {
            data: names
              .filter((name) => existingObjectNames.includes(name))
              .map((name) => ({ name })),
            error: null,
          };
        }),
        ilike: ilikeMock,
      })),
    })),
  };

  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "media_files") return mediaFilesFromMock;
      throw new Error(`Unexpected table: ${table}`);
    }),
    schema: vi.fn((schemaName: string) => {
      if (schemaName !== "storage") throw new Error(`Unexpected schema: ${schemaName}`);
      return {
        from: vi.fn((table: string) => {
          if (table !== "objects") throw new Error(`Unexpected table in storage schema: ${table}`);
          return storageObjectsFromMock;
        }),
      };
    }),
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: createSignedUrlMock,
      })),
    },
  });

  return {
    createSignedUrlMock,
    getCapturedInNames: () => capturedInNames,
    getIlikePatterns: () => ilikePatterns,
  };
};

describe("POST /api/media/resolve-previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs scoped media paths for user-owned rows", async () => {
    const row = createRow();
    const { createSignedUrlMock } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [row.storage_path as string],
      signedUrlsByPath: {
        [row.storage_path as string]: "https://example.test/signed-scoped",
      },
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlMock).toHaveBeenCalledWith(row.storage_path as string, 3600);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: "https://example.test/signed-scoped",
      },
    });
  });

  it.each(["media-library-panel", "elements-media-panel"] as const)(
    "does not apply transforms by default when surface is %s",
    async (surface) => {
      const row = createRow({
        id: "media-panel-1",
        storage_path: "user-1/uploads/images/panel-image.jpg",
        file_type: "image/jpeg",
      });
      const { createSignedUrlMock } = setupSupabaseAdmin({
        rows: [row],
        existingObjectNames: [row.storage_path as string],
      });

      const req = {
        method: "POST",
        body: {
          ids: [row.id],
          surface,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(res.setHeader).toHaveBeenCalledWith(
        "x-shortpulse-media-resolve-preview-profile",
        "media-library-panel-image-card"
      );
      expect(createSignedUrlMock).toHaveBeenCalledWith(row.storage_path as string, 3600);
      expect(res.status).toHaveBeenCalledWith(200);
    }
  );

  it.each(["media-library-panel", "elements-media-panel"] as const)(
    "keeps direct signing behavior for %s even when transform flags are enabled",
    async (surface) => {
      vi.stubEnv("SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");
      vi.stubEnv("NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED", "true");

      const row = createRow({
        id: "media-panel-transform-1",
        storage_path: "user-1/uploads/images/panel-image.jpg",
        file_type: "image/jpeg",
      });
      const { createSignedUrlMock } = setupSupabaseAdmin({
        rows: [row],
        existingObjectNames: [row.storage_path as string],
      });

      const req = {
        method: "POST",
        body: {
          ids: [row.id],
          surface,
        },
      };
      const res = createMockResponse();

      await handler(req as never, res as never);

      expect(createSignedUrlMock).toHaveBeenCalledWith(row.storage_path as string, 3600);
      expect(res.status).toHaveBeenCalledWith(200);
    }
  );

  it("prefers durable variant paths over original storage paths when both exist", async () => {
    const row = createRow({
      id: "media-variant-1",
      storage_path: "user-1/uploads/images/original.jpg",
      thumb_variant_path: "user-1/variants/images/media-variant-1/thumb_480",
      file_type: "image/jpeg",
    });
    const { createSignedUrlMock, getCapturedInNames } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [row.thumb_variant_path as string, row.storage_path as string],
      signedUrlsByPath: {
        [row.thumb_variant_path as string]: "https://example.test/variant-signed",
      },
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getCapturedInNames()).toContain(row.thumb_variant_path as string);
    expect(createSignedUrlMock).toHaveBeenCalledWith(row.thumb_variant_path as string, 3600);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: "https://example.test/variant-signed",
      },
    });
  });

  it("narrows browse-surface storage lookup to preferred and original candidates", async () => {
    const row = createRow({
      id: "media-browse-candidates-1",
      storage_path: "user-1/uploads/images/original.jpg",
      thumb_variant_path: "user-1/variants/images/media-browse-candidates-1/thumb_480",
      metadata: {
        variant_paths: {
          image: "user-1/variants/images/media-browse-candidates-1/thumb_240",
        },
      },
    });
    const { getCapturedInNames } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [],
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getCapturedInNames()).toEqual([
      row.thumb_variant_path as string,
      row.storage_path as string,
    ]);
  });

  it("never signs out-of-scope storage paths", async () => {
    const row = createRow({
      id: "media-2",
      storage_path: "user-2/images/victim.jpg",
      filename: "victim.jpg",
    });
    const { createSignedUrlMock, getCapturedInNames } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: ["user-2/images/victim.jpg"],
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(getCapturedInNames()).not.toContain("user-2/images/victim.jpg");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: null,
      },
    });
  });

  it("logs and sanitizes media row lookup failures", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: null,
              error: { message: "relation media_files does not exist" },
            })),
          })),
        })),
      })),
    });

    const req = {
      method: "POST",
      body: {
        ids: ["media-1"],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "media-resolve-previews",
        user: expect.objectContaining({ id: "user-1" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Failed to resolve media previews",
    });
  });

  it("rejects direct URL fallback when it resolves outside the caller namespace", async () => {
    const row = createRow({
      id: "media-3",
      storage_path: "user-1/images/local.jpg",
      thumb_variant_path: "https://cdn.example.test/media_library/user-2/private/images/pwned.jpg",
    });
    const { createSignedUrlMock } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [],
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: null,
      },
    });
  });

  it("allows direct URL fallback when it resolves to the caller namespace without basename repair", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const directUrl = "https://cdn.example.test/media_library/user-1/private/images/legacy.jpg";
    const row = createRow({
      id: "media-4",
      storage_path: "user-1/images/local.jpg",
      thumb_variant_path: directUrl,
    });

    const { createSignedUrlMock, getIlikePatterns } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [],
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(getIlikePatterns()).toEqual([]);
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-resolve-fallback-lookups", "0");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: directUrl,
      },
    });
  });

  it("prefers trusted direct preview urls over storage lookup on browse surfaces", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const directUrl = "https://cdn.example.test/media_library/user-1/private/images/browse.jpg";
    const row = createRow({
      id: "media-4b",
      storage_path: "user-1/images/local-browse.jpg",
      thumb_variant_path: directUrl,
    });

    const { createSignedUrlMock, getCapturedInNames, getIlikePatterns } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [row.storage_path as string],
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getCapturedInNames()).toEqual([]);
    expect(getIlikePatterns()).toEqual([]);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-resolve-fallback-lookups", "0");
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: directUrl,
      },
    });
  });

  it("dedupes basename fallback lookups and reports unique lookup count", async () => {
    const rowA = createRow({
      id: "media-a",
      filename: "shared.jpg",
      storage_path: "user-1/images/shared.jpg",
    });
    const rowB = createRow({
      id: "media-b",
      filename: "shared.jpg",
      storage_path: "user-1/private/shared.jpg",
    });
    const rowC = createRow({
      id: "media-c",
      filename: "second.jpg",
      storage_path: "user-1/images/second.jpg",
    });
    const { createSignedUrlMock, getIlikePatterns } = setupSupabaseAdmin({
      rows: [rowA, rowB, rowC],
      existingObjectNames: [],
      basenameMatches: {
        "user-1/%/shared.jpg": "user-1/recovered/shared.jpg",
        "user-1/%/second.jpg": "user-1/recovered/second.jpg",
      },
    });

    const req = {
      method: "POST",
      body: {
        ids: [rowA.id, rowB.id, rowC.id],
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getIlikePatterns().sort()).toEqual(["user-1/%/second.jpg", "user-1/%/shared.jpg"]);
    expect(createSignedUrlMock).toHaveBeenCalledWith("user-1/recovered/shared.jpg", 3600);
    expect(createSignedUrlMock).toHaveBeenCalledWith("user-1/recovered/second.jpg", 3600);
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-resolve-fallback-lookups", "2");
  });

  it("skips basename fallback jobs for non-resolvable basenames", async () => {
    const row = createRow({
      id: "media-underscore-1",
      filename: "generated_asset.jpg",
      storage_path: "user-1/images/generated_asset.jpg",
    });
    const { createSignedUrlMock, getIlikePatterns } = setupSupabaseAdmin({
      rows: [row],
      existingObjectNames: [],
      basenameMatches: {
        "user-1/%/generated_asset.jpg": "user-1/recovered/generated_asset.jpg",
      },
    });

    const req = {
      method: "POST",
      body: {
        ids: [row.id],
        surface: "media-library-modal",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getIlikePatterns()).toEqual([]);
    expect(createSignedUrlMock).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("x-shortpulse-media-resolve-fallback-lookups", "0");
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: null,
      },
    });
  });
});
