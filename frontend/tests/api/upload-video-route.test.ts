import { EventEmitter } from "events";
import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-video";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

let mockParseError: Error | null = null;
let mockFile = {
  filepath: "/tmp/mock-video",
  mimetype: "video/mp4",
  size: 32,
  originalFilename: "clip.mp4",
};

const formidableFactoryMock = vi.fn(() => ({
  parse: (
    _req: unknown,
    callback: (err: unknown, fields: unknown, files: Record<string, unknown>) => void
  ) => {
    if (mockParseError) {
      callback(mockParseError, {}, {});
      return;
    }
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

describe("POST /api/upload-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    mockParseError = null;
    mockFile = {
      filepath: "/tmp/mock-video",
      mimetype: "video/mp4",
      size: 32,
      originalFilename: "clip.mp4",
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
  });

  it("rejects mismatched content type vs file signature", async () => {
    // WebM-like signature (EBML + 'webm' marker in initial bytes)
    const webmBuffer = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(8, 0),
      Buffer.from("webm", "ascii"),
    ]);
    vi.spyOn(fs, "readFileSync").mockReturnValue(webmBuffer);
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: vi.fn() },
    });

    const req = { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details: "File content is not a supported video format (detected: unknown).",
    });
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("returns legacy signed upload metadata while using shared validation", async () => {
    const rawBody = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypmp42", "ascii"),
    ]);
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/motion-video",
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
        "content-type": "video/mp4",
        "x-shortpulse-upload-filename": "clip.mp4",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", rawBody);
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/motion-video",
      path: expect.stringMatching(/^user-1\/videos\/motion-control\//),
      size: rawBody.length,
    });
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.media.upload_adapter.upload_video_used",
        route: "upload-video",
        userId: "user-1",
        userEmail: "u@example.com",
        metadata: expect.objectContaining({
          method: "POST",
          route_label: "upload-video",
          file_size: rawBody.length,
        }),
      })
    );
  });

  it("continues to accept multipart uploads for compatibility", async () => {
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypmp42", "ascii")])
    );
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/motion-video",
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

    const req = { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/motion-video",
      path: expect.stringMatching(/^user-1\/videos\/motion-control\//),
      size: 32,
    });
    expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/mock-video");
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.media.upload_adapter.upload_video_used",
        route: "upload-video",
        userId: "user-1",
        userEmail: "u@example.com",
        metadata: expect.objectContaining({
          method: "POST",
          route_label: "upload-video",
          file_size: 32,
        }),
      })
    );
  });

  it("accepts generic octet-stream declared mime when file signature is a supported raw video", async () => {
    const rawBody = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypiso6", "ascii"),
    ]);
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/motion-video",
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
        "content-type": "application/octet-stream",
        "x-shortpulse-upload-filename": "clip.mp4",
      },
      destroy: vi.fn(),
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", rawBody);
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(200);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4" })
    );
  });

  it("accepts generic octet-stream declared mime when file signature is a supported multipart video", async () => {
    mockFile = {
      filepath: "/tmp/mock-video",
      mimetype: "application/octet-stream",
      size: 32,
      originalFilename: "clip.mp4",
    };
    vi.spyOn(fs, "readFileSync").mockReturnValue(
      Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypiso6", "ascii")])
    );
    const uploadMock = vi.fn(async () => ({ error: null }));
    const createSignedUrlMock = vi.fn(async () => ({
      data: {
        signedUrl: "https://signed.example/motion-video",
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

    const req = { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\//),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4" })
    );
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

  it("logs unexpected multipart parser failures and returns 500", async () => {
    mockParseError = new Error("Multipart parser exploded");

    const req = { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Upload failed",
      details: "Multipart parser exploded",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "upload-video",
        error: expect.objectContaining({ message: "Multipart parser exploded" }),
      })
    );
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });
});
