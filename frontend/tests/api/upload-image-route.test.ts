import { EventEmitter } from "events";
import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-image";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

let mockFile = {
  filepath: "/tmp/mock-image",
  mimetype: "image/png",
  size: 16,
  originalFilename: "reference.png",
};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (err: unknown, fields: unknown, files: Record<string, unknown>) => void
  ) => {
    callback(null, {}, { file: mockFile });
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
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/upload-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    mockFile = {
      filepath: "/tmp/mock-image",
      mimetype: "image/png",
      size: 16,
      originalFilename: "reference.png",
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  it("returns legacy signed upload metadata while using shared validation", async () => {
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/reference-image",
      },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          upload: uploadMock,
          createSignedUrl: createSignedUrlMock,
        })),
      },
    });

    const req = Object.assign(new EventEmitter(), {
      method: "POST",
      headers: {
        "content-type": "image/png",
        "x-shortpulse-upload-filename": "reference.png",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/images\/reference\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png", upsert: false })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://signed.example/reference-image",
        path: expect.stringMatching(/^user-1\/images\/reference\//),
        size: 8,
      })
    );
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.media.upload_adapter.upload_image_used",
        route: "upload-image",
        userId: "user-1",
        userEmail: "u@example.com",
        metadata: expect.objectContaining({
          method: "POST",
          route_label: "upload-image",
          file_size: 8,
        }),
      })
    );
  });

  it("rejects mismatched content type vs file signature", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(Buffer.from([0xff, 0xd8, 0xff, 0xdb]));
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: vi.fn() },
    });

    const req = { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details:
        "Content type does not match file content (declared: image/png, detected: image/jpeg).",
    });
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("returns shared validation errors for missing raw content type", async () => {
    const req = { method: "POST", headers: {}, destroy: vi.fn() };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upload failed",
      details: "Missing content type",
    });
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });
});
