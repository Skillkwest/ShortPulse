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
  const createSignedUrlsMock = vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({
      path,
      signedUrl:
        signedUrlsByPath?.[path] ?? `https://example.test/signed/${encodeURIComponent(path)}`,
    })),
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
        ilike: vi.fn((_column: string, pattern: string) => ({
          limit: vi.fn(async () => ({
            data: (() => {
              const match = basenameMatches?.[pattern] ?? null;
              return match ? [{ name: match }] : [];
            })(),
            error: null,
          })),
        })),
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
        createSignedUrls: createSignedUrlsMock,
      })),
    },
  });

  return {
    createSignedUrlsMock,
    getCapturedInNames: () => capturedInNames,
  };
};

describe("POST /api/media/resolve-previews", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1" });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs scoped media paths for user-owned rows", async () => {
    const row = createRow();
    const { createSignedUrlsMock } = setupSupabaseAdmin({
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

    expect(createSignedUrlsMock).toHaveBeenCalledWith([row.storage_path], 3600);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: "https://example.test/signed-scoped",
      },
    });
  });

  it("never signs out-of-scope storage paths", async () => {
    const row = createRow({
      id: "media-2",
      storage_path: "user-2/images/victim.jpg",
      filename: "victim.jpg",
    });
    const { createSignedUrlsMock, getCapturedInNames } = setupSupabaseAdmin({
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

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(getCapturedInNames()).not.toContain("user-2/images/victim.jpg");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: null,
      },
    });
  });

  it("rejects direct URL fallback when it resolves outside the caller namespace", async () => {
    const row = createRow({
      id: "media-3",
      storage_path: "user-1/images/local.jpg",
      thumb_variant_path: "https://cdn.example.test/media_library/user-2/private/images/pwned.jpg",
    });
    const { createSignedUrlsMock } = setupSupabaseAdmin({
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

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: null,
      },
    });
  });

  it("allows direct URL fallback when it resolves to the caller namespace", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS", "true");
    vi.stubEnv("SHORTPULSE_MEDIA_DIRECT_URL_ALLOWED_HOSTS", "cdn.example.test");

    const directUrl = "https://cdn.example.test/media_library/user-1/private/images/legacy.jpg";
    const row = createRow({
      id: "media-4",
      storage_path: "user-1/images/local.jpg",
      thumb_variant_path: directUrl,
    });

    const { createSignedUrlsMock } = setupSupabaseAdmin({
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

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      urls: {
        [row.id]: directUrl,
      },
    });
  });
});
