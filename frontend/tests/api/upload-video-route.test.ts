import { EventEmitter } from "events";
import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-video";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const retireMotionReferenceVideoStoragePathForUserMock = vi.fn();
const normalizeMotionReferenceVideoForProviderMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../lib/server/motionReferenceVideoAssetLease", () => ({
  retireMotionReferenceVideoStoragePathForUser: (...args: unknown[]) =>
    retireMotionReferenceVideoStoragePathForUserMock(...args),
}));

vi.mock("../../lib/server/motionReferenceVideoNormalization", () => ({
  MotionReferenceVideoNormalizationError: class MotionReferenceVideoNormalizationError extends Error {
    readonly status: number;
    readonly details?: string;

    constructor(status: number, message: string, details?: string) {
      super(message);
      this.status = status;
      this.details = details;
    }
  },
  normalizeMotionReferenceVideoForProvider: (...args: unknown[]) =>
    normalizeMotionReferenceVideoForProviderMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  end: vi.fn().mockReturnThis(),
});

const buildWebmTrackSignature = (trackType: number): Buffer =>
  Buffer.from([
    0x1a,
    0x45,
    0xdf,
    0xa3,
    0x87,
    0x42,
    0x82,
    0x84,
    0x77,
    0x65,
    0x62,
    0x6d,
    0x18,
    0x53,
    0x80,
    0x67,
    0x8a,
    0x16,
    0x54,
    0xae,
    0x6b,
    0x85,
    0xae,
    0x83,
    0x83,
    0x81,
    trackType,
  ]);

describe("/api/upload-video", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
    retireMotionReferenceVideoStoragePathForUserMock.mockResolvedValue({
      deleted: false,
      waitingOnLease: true,
    });
    normalizeMotionReferenceVideoForProviderMock.mockImplementation(
      async ({
        buffer,
        filename,
        mimeType,
      }: {
        buffer: Buffer;
        filename: string;
        mimeType: string;
      }) => ({
        buffer,
        filename,
        mimeType,
      })
    );
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
      mimeType: "video/mp4",
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
      size: 12,
      mimeType: "video/mp4",
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
          file_size: 12,
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

  it("accepts quicktime aliases for mov uploads and returns the detected mime type", async () => {
    const rawBody = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypqt  ", "ascii"),
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
        "content-type": "video/x-quicktime",
        "x-shortpulse-upload-filename": "clip.mov",
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
      expect.objectContaining({ contentType: "video/quicktime", upsert: false })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/motion-video",
      path: expect.stringMatching(/^user-1\/videos\/motion-control\//),
      size: rawBody.length,
      mimeType: "video/quicktime",
    });
  });

  it("normalizes WebM motion-control uploads to provider-ready MP4", async () => {
    const rawBody = buildWebmTrackSignature(0x01);
    const normalizedBody = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18]),
      Buffer.from("ftypmp42", "ascii"),
    ]);
    normalizeMotionReferenceVideoForProviderMock.mockResolvedValueOnce({
      buffer: normalizedBody,
      filename: "sample.mp4",
      mimeType: "video/mp4",
    });
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
        "content-type": "video/webm",
        "x-shortpulse-upload-filename": "sample.webm",
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

    expect(normalizeMotionReferenceVideoForProviderMock).toHaveBeenCalledWith({
      buffer: rawBody,
      filename: "sample.webm",
      mimeType: "video/webm",
    });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/^user-1\/videos\/motion-control\/.*sample\.mp4$/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "video/mp4", upsert: false })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://signed.example/motion-video",
      path: expect.stringMatching(/^user-1\/videos\/motion-control\/.*sample\.mp4$/),
      size: normalizedBody.length,
      mimeType: "video/mp4",
    });
  });

  it("rejects audio-only WebM uploads for motion-control sources", async () => {
    const rawBody = buildWebmTrackSignature(0x02);
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(),
      },
    });

    const req = Object.assign(new EventEmitter(), {
      method: "POST",
      headers: {
        "content-type": "video/webm",
        "x-shortpulse-upload-filename": "sample.webm",
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

    expect(normalizeMotionReferenceVideoForProviderMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid file type",
      details: "Motion reference source must be a playable video between 3 and 30 seconds.",
    });
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
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "upload-video",
        error: expect.objectContaining({ message: "Multipart parser exploded" }),
      })
    );
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated video uploads for the same authenticated user", async () => {
    const buildReq = () =>
      Object.assign(new EventEmitter(), {
        method: "POST",
        headers: {
          "content-type": "video/mp4",
          "x-shortpulse-upload-filename": "clip.mp4",
        },
        destroy: vi.fn(),
        socket: { remoteAddress: "127.0.0.1" },
      });

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const req = buildReq();
      const res = createMockResponse();
      const handlerPromise = handler(req as never, res as never);
      await new Promise<void>((resolve) => {
        setImmediate(() => {
          req.emit(
            "data",
            Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from("ftypmp42", "ascii")])
          );
          req.emit("end");
          resolve();
        });
      });
      await handlerPromise;
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const req = buildReq();
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });

  it("deletes stale motion-control uploads inside the caller namespace", async () => {
    const removeMock = vi.fn(async () => ({ data: [], error: null }));
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          remove: removeMock,
        })),
      },
    });

    const req = Object.assign(new EventEmitter(), {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", JSON.stringify({ path: "user-1/videos/motion-control/stale.mp4" }));
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(removeMock).toHaveBeenCalledWith(["user-1/videos/motion-control/stale.mp4"]);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
    expect(writeAppErrorLogMock).not.toHaveBeenCalled();
  });

  it("rejects stale motion cleanup requests outside the motion-control namespace", async () => {
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
        })),
      },
    });

    const req = Object.assign(new EventEmitter(), {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit("data", JSON.stringify({ path: "user-1/videos/other-folder/stale.mp4" }));
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request",
      details: "Uploaded asset storage path is outside the expected namespace.",
    });
  });

  it("retires committed motion-control uploads through the lease-aware lifecycle", async () => {
    const req = Object.assign(new EventEmitter(), {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
      },
    });
    const res = createMockResponse();
    const handlerPromise = handler(req as never, res as never);
    await new Promise<void>((resolve) => {
      setImmediate(() => {
        req.emit(
          "data",
          JSON.stringify({
            path: "user-1/videos/motion-control/retire.mp4",
            mode: "retire",
          })
        );
        req.emit("end");
        resolve();
      });
    });
    await handlerPromise;

    expect(retireMotionReferenceVideoStoragePathForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      storagePath: "user-1/videos/motion-control/retire.mp4",
    });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});
