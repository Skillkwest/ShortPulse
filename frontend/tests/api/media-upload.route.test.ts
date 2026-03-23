import fs from "fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/media/upload";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

let mockFields: Record<string, unknown> = {};
let mockFile = {
  filepath: "/tmp/mock-media-upload",
  mimetype: "image/png",
  size: 16,
  originalFilename: "asset.png",
};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (err: unknown, fields: unknown, files: Record<string, unknown>) => void
  ) => {
    callback(null, mockFields, { file: mockFile });
  },
}));

vi.mock("formidable", () => ({
  default: () => formidableFactoryMock(),
}));

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const setupSupabaseUpload = (options?: {
  insertedRow?: Record<string, unknown>;
  uploadError?: { message: string } | null;
  signedUrl?: string;
}) => {
  const uploadMock = vi.fn(async () => ({ error: options?.uploadError ?? null }));
  const createSignedUrlMock = vi.fn(async () => ({
    data: {
      signedUrl: options?.signedUrl ?? "https://signed.example/media-upload",
    },
    error: null,
  }));

  const singleMock = vi.fn(async () => ({
    data: {
      id: "media-upload-1",
      user_id: "user-1",
      filename: "asset.png",
      storage_path: "user-1/private/images/media-upload-1-asset.png",
      file_type: "image",
      file_size: 16,
      source: "private_upload",
      created_at: "2026-02-27T00:00:00.000Z",
      metadata: {},
      thumb_variant_path: null,
      poster_variant_path: null,
      preview_variant_path: null,
      ...(options?.insertedRow ?? {}),
    },
    error: null,
  }));

  const selectMock = vi.fn(() => ({ single: singleMock }));
  const insertMock = vi.fn(() => ({ select: selectMock }));
  const fromMock = vi.fn((table: string) => {
    if (table === "media_files") {
      return {
        insert: insertMock,
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  getSupabaseAdminMock.mockReturnValue({
    storage: {
      from: vi.fn(() => ({
        upload: uploadMock,
        createSignedUrl: createSignedUrlMock,
      })),
    },
    from: fromMock,
  });

  return {
    uploadMock,
    createSignedUrlMock,
    insertMock,
  };
};

describe("POST /api/media/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    mockFields = { destinationTab: "private" };
    mockFile = {
      filepath: "/tmp/mock-media-upload",
      mimetype: "image/png",
      size: 16,
      originalFilename: "asset.png",
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uploads and persists media for a private destination", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    const { uploadMock, insertMock } = setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        source: "private_upload",
        file_type: "image",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      file: expect.objectContaining({
        id: "media-upload-1",
        storage_path: expect.stringMatching(/^user-1\/private\/images\//),
        preview_storage_path: expect.stringMatching(/^user-1\//),
        signedUrl: "https://signed.example/media-upload",
      }),
    });
  });

  it("rejects mismatched content type vs file signature", async () => {
    // JPEG signature while multipart declares image/png
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details:
        "Content type does not match file content (declared: image/png, detected: image/jpeg).",
    });
  });

  it("returns 503 when media upload API is disabled", async () => {
    vi.stubEnv("SHORTPULSE_MEDIA_UPLOAD_API_ENABLED", "false");
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    setupSupabaseUpload();

    const req = {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=x",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media upload API is disabled",
      details: "Enable SHORTPULSE_MEDIA_UPLOAD_API_ENABLED to use this route.",
    });
  });
});
