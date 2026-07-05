// @vitest-environment node

import { EventEmitter } from "node:events";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kie/upload-url";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const dnsLookupMock = vi.hoisted(() => vi.fn());
const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const requireMediaComplianceAcceptedMock = vi.fn();
const readProviderApiKeyMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("node:dns/promises", () => ({
  default: {
    lookup: (...args: unknown[]) => dnsLookupMock(...args),
  },
  lookup: (...args: unknown[]) => dnsLookupMock(...args),
}));

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/mediaComplianceGuard", () => ({
  requireMediaComplianceAccepted: (...args: unknown[]) =>
    requireMediaComplianceAcceptedMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

vi.mock("../../lib/server/providerIntegration/providerRuntimeConfig", () => ({
  readProviderApiKey: (...args: unknown[]) => readProviderApiKeyMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createMockRequest = ({
  body,
  headers = {},
}: {
  body: Buffer | string;
  headers?: Record<string, string>;
}) => {
  const req = new EventEmitter() as EventEmitter & {
    method: string;
    headers: Record<string, string>;
  };
  req.method = "POST";
  req.headers = headers;
  setTimeout(() => {
    req.emit("data", typeof body === "string" ? Buffer.from(body) : body);
    req.emit("end");
  }, 0);
  return req;
};

describe("POST /api/kie/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    vi.unstubAllGlobals();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    requireMediaComplianceAcceptedMock.mockResolvedValue(true);
    readProviderApiKeyMock.mockReturnValue("kie-test-key");
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    getSupabaseAdminMock.mockReturnValue({
      storage: {
        from: vi.fn(() => ({
          download: vi.fn().mockResolvedValue({
            data: {
              size: 4,
              type: "image/png",
              arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
            },
            error: null,
          }),
        })),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs auth verifier failures before reading upload bodies or provider config", async () => {
    const authError = new Error("auth verifier exploded");
    requireApiUserMock.mockRejectedValueOnce(authError);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://example.com/public-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        error: authError,
        routeLabel: "kie-upload-url.auth",
        scope: "generation",
      })
    );
    expect(readProviderApiKeyMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
    });
  });

  it("rejects Kie provider uploads before reading bodies when media consent is missing", async () => {
    requireMediaComplianceAcceptedMock.mockImplementationOnce(async ({ res }) => {
      res.status(403).json({
        error: "Media agreement acceptance is required.",
        code: "MEDIA_COMPLIANCE_REQUIRED",
      });
      return false;
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://example.com/public-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(readProviderApiKeyMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media agreement acceptance is required.",
      code: "MEDIA_COMPLIANCE_REQUIRED",
    });
  });

  it("uses Kie URL upload for public remote URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/public-image.jpg",
          fileName: "public-image.jpg",
          mimeType: "image/jpeg",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://example.com/public-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://kieai.redpandaai.co/api/file-url-upload",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer kie-test-key",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/public-image.jpg",
      fileName: "public-image.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("accepts top-level upload URLs when Kie omits the data wrapper", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        downloadUrl: "https://tempfile.redpandaai.co/files/public-image-top-level.jpg",
        fileName: "public-image-top-level.jpg",
        mimeType: "image/jpeg",
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://example.com/public-image-top-level.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/public-image-top-level.jpg",
      fileName: "public-image-top-level.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("uses Kie URL upload first for Supabase signed URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/signed-image.png",
          fileName: "signed-image.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl:
          "https://project.supabase.co/storage/v1/object/sign/media_library/user/ref.png?token=abc",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-url-upload");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/signed-image.png",
      fileName: "signed-image.png",
      mimeType: "image/png",
    });
  });

  it("streams caller-owned storage paths to Kie without requiring a public source URL", async () => {
    const downloadMock = vi.fn().mockResolvedValue({
      data: {
        size: 4,
        type: "image/png",
        arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer,
      },
      error: null,
    });
    const fromMock = vi.fn(() => ({ download: downloadMock }));
    getSupabaseAdminMock.mockReturnValueOnce({
      storage: {
        from: fromMock,
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/storage-image.png",
          fileName: "storage-image.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/references/storage-image.png",
        mediaKind: "image",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(dnsLookupMock).not.toHaveBeenCalled();
    expect(fromMock).toHaveBeenCalledWith("media_library");
    expect(downloadMock).toHaveBeenCalledWith("user-1/references/storage-image.png");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const uploadInit = fetchMock.mock.calls[0]?.[1] as { body?: FormData };
    expect(uploadInit.body).toBeInstanceOf(FormData);
    expect((uploadInit.body as FormData).get("uploadPath")).toBe("shortpulse/kie-video/images");
    expect((uploadInit.body as FormData).get("fileName")).toBe("storage-image.png");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/storage-image.png",
      fileName: "storage-image.png",
      mimeType: "image/png",
    });
  });

  it("admits Motion Control character images from owned storage before Kie upload", async () => {
    const webpImage = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 30, g: 90, b: 140 },
      },
    })
      .webp()
      .toBuffer();
    const downloadMock = vi.fn().mockResolvedValue({
      data: {
        size: webpImage.length,
        type: "image/webp",
        arrayBuffer: async () =>
          webpImage.buffer.slice(webpImage.byteOffset, webpImage.byteOffset + webpImage.byteLength),
      },
      error: null,
    });
    const fromMock = vi.fn(() => ({ download: downloadMock }));
    getSupabaseAdminMock.mockReturnValueOnce({
      storage: {
        from: fromMock,
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/character.jpg",
          fileName: "character.jpg",
          mimeType: "image/jpeg",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/references/character.webp",
        mediaKind: "image",
        uploadPath: "shortpulse/kie-video/images",
        admissionProfile: "kie_motion_control_character_image",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const uploadInit = fetchMock.mock.calls[0]?.[1] as { body?: FormData };
    const uploadedFile = (uploadInit.body as FormData).get("file") as File;
    expect(uploadedFile.type).toBe("image/jpeg");
    expect(uploadedFile.name).toBe("character.jpg");
    expect((uploadInit.body as FormData).get("fileName")).toBe("character.jpg");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/character.jpg",
      fileName: "character.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("admits undersized Seedance reference images from owned storage before Kie upload", async () => {
    const smallImage = await sharp({
      create: {
        width: 240,
        height: 180,
        channels: 3,
        background: { r: 40, g: 80, b: 120 },
      },
    })
      .png()
      .toBuffer();
    const downloadMock = vi.fn().mockResolvedValue({
      data: {
        size: smallImage.length,
        type: "image/png",
        arrayBuffer: async () =>
          smallImage.buffer.slice(
            smallImage.byteOffset,
            smallImage.byteOffset + smallImage.byteLength
          ),
      },
      error: null,
    });
    const fromMock = vi.fn(() => ({ download: downloadMock }));
    getSupabaseAdminMock.mockReturnValueOnce({
      storage: {
        from: fromMock,
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/seedance-reference.png",
          fileName: "seedance-reference.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/references/seedance-reference.png",
        mediaKind: "image",
        uploadPath: "shortpulse/kie-video/images",
        admissionProfile: "kie_seedance_reference_image",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const uploadInit = fetchMock.mock.calls[0]?.[1] as { body?: FormData };
    const uploadedFile = (uploadInit.body as FormData).get("file") as File;
    expect(uploadedFile.type).toBe("image/png");
    expect(uploadedFile.name).toBe("seedance-reference.png");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/seedance-reference.png",
      fileName: "seedance-reference.png",
      mimeType: "image/png",
    });
  });

  it("admits GPT Image 2 reference images from owned storage before Kie upload", async () => {
    const avifImage = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 80, g: 40, b: 160 },
      },
    })
      .avif()
      .toBuffer();
    const downloadMock = vi.fn().mockResolvedValue({
      data: {
        size: avifImage.length,
        type: "image/avif",
        arrayBuffer: async () =>
          avifImage.buffer.slice(avifImage.byteOffset, avifImage.byteOffset + avifImage.byteLength),
      },
      error: null,
    });
    const fromMock = vi.fn(() => ({ download: downloadMock }));
    getSupabaseAdminMock.mockReturnValueOnce({
      storage: {
        from: fromMock,
      },
    });
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/gpt-reference.jpg",
          fileName: "gpt-reference.jpg",
          mimeType: "image/jpeg",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/references/gpt-reference.avif",
        mediaKind: "image",
        uploadPath: "shortpulse/kie-video/images",
        admissionProfile: "kie_gpt_image_2_reference_image",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const uploadInit = fetchMock.mock.calls[0]?.[1] as { body?: FormData };
    const uploadedFile = (uploadInit.body as FormData).get("file") as File;
    expect(uploadedFile.type).toMatch(/^image\/(jpeg|webp)$/);
    expect(uploadedFile.name).toMatch(/^gpt-reference\.(?:jpg|webp)$/);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/gpt-reference.jpg",
      fileName: "gpt-reference.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("rejects Motion Control image admission profiles outside the Kie image upload path", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/videos/motion-control/motion.mp4",
        mediaKind: "video",
        uploadPath: "shortpulse/kie-video/videos",
        admissionProfile: "kie_motion_control_character_image",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "admissionProfile is only supported for Kie image uploads.",
    });
  });

  it("returns deterministic source-fetch failures for profiled remote Motion Control images", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "text/plain" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/missing-character.webp",
        uploadPath: "shortpulse/kie-video/images",
        admissionProfile: "kie_motion_control_character_image",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://cdn.example.com/missing-character.webp");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "Source fetch failed (404).",
    });
  });

  it("uses Kie URL upload first for uppercase signed-query URLs", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/signed-aws-image.png",
          fileName: "signed-aws-image.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl:
          "https://cdn.example.com/ref.png?X-Amz-Signature=abc123&X-Amz-Security-Token=session-token",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-url-upload");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("falls back to stream upload when Kie URL upload rejects the remote URL", async () => {
    const sourceBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          msg: "Forbidden",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => sourceBytes.buffer,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          msg: "File uploaded successfully",
          data: {
            downloadUrl: "https://tempfile.redpandaai.co/files/fallback-image.jpg",
            fileName: "fallback-image.jpg",
            mimeType: "image/jpeg",
          },
        }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/fallback-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-url-upload");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://cdn.example.com/fallback-image.jpg");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/fallback-image.jpg",
      fileName: "fallback-image.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("falls back to stream upload when Kie success returns no file URL", async () => {
    const sourceBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xdb]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
        text: async () => "<html><body>temporary upstream response</body></html>",
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg" }),
        arrayBuffer: async () => sourceBytes.buffer,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          msg: "File uploaded successfully",
          data: {
            downloadUrl: "https://tempfile.redpandaai.co/files/recovered-image.jpg",
            fileName: "recovered-image.jpg",
            mimeType: "image/jpeg",
          },
        }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/recovered-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-url-upload");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://cdn.example.com/recovered-image.jpg");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/recovered-image.jpg",
      fileName: "recovered-image.jpg",
      mimeType: "image/jpeg",
    });
  });

  it("does not fallback when Kie returns an explicit JSON failure with HTTP 200", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        success: false,
        code: 401,
        msg: "Authentication failed: Unauthorized",
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/auth-failed-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
      details: "Authentication failed: Unauthorized",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "kie-upload-url",
        user: { id: "user-1", email: "user@example.com" },
        metadata: expect.objectContaining({
          kie_upload_failure: "upstream_provider_failure",
          kie_upload_transport: "url_upload",
          kie_upstream_status: 200,
          kie_upstream_content_type: "application/json",
          kie_upload_fallback_attempted: false,
        }),
      })
    );
  });

  it("logs and classifies non-JSON upstream failures from Kie", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => "<html><body>Unauthorized</body></html>",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/fallback-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
      details: "Upstream upload failed with status 401 and returned an HTML response.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "kie-upload-url",
        user: { id: "user-1", email: "user@example.com" },
        metadata: expect.objectContaining({
          kie_upload_failure: "upstream_non_ok",
          kie_upload_transport: "url_upload",
          kie_upstream_status: 401,
          kie_upstream_content_type: "text/html; charset=utf-8",
          kie_upstream_body_format: "html_like",
          kie_upstream_parse_source: "text",
          kie_upstream_json_parsed: false,
          kie_upload_fallback_attempted: false,
        }),
      })
    );
  });

  it("rejects local or private-network source URLs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "http://127.0.0.1:54321/private.png",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "fileUrl cannot target a local or private-network host.",
    });
  });

  it("rejects public hostnames that resolve to private-network addresses", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.12", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/private-after-dns.png",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "fileUrl host resolved to a private-network address.",
    });
  });

  it("rejects stream uploads that exceed the remote source size limit", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          msg: "Forbidden",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "image/png",
          "content-length": String(101 * 1024 * 1024),
        }),
        arrayBuffer: async () => new ArrayBuffer(0),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl:
          "https://project.supabase.co/storage/v1/object/sign/media_library/user/ref.png?token=abc",
        uploadPath: "shortpulse/kie-video/images",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "Source file exceeds the maximum upload size.",
    });
  });

  it("accepts direct binary uploads for local media staged from the client", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/local-image.png",
          fileName: "local-image.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "image/png",
        "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        "x-shortpulse-upload-filename": "local-image.png",
      },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const firstCall = fetchMock.mock.calls[0]?.[1] as { body?: FormData; headers?: HeadersInit };
    expect(firstCall.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer kie-test-key",
      })
    );
    expect(firstCall.body).toBeInstanceOf(FormData);
    expect((firstCall.body as FormData).get("uploadPath")).toBe("shortpulse/kie-video/images");
    expect((firstCall.body as FormData).get("fileName")).toBe("local-image.png");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://tempfile.redpandaai.co/files/local-image.png",
      fileName: "local-image.png",
      mimeType: "image/png",
    });
  });

  it("logs upstream shape when Kie returns success without a file URL", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      text: async () => "<html><body>temporary upstream response</body></html>",
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "image/png",
        "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        "x-shortpulse-upload-filename": "local-image.png",
      },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
      details: "Upload succeeded but returned no file URL.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledTimes(1);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "kie-upload-url",
        user: { id: "user-1", email: "user@example.com" },
        metadata: expect.objectContaining({
          kie_upload_failure: "missing_uploaded_url",
          kie_upload_transport: "binary_stream_upload",
          kie_upstream_status: 200,
          kie_upstream_content_type: "text/html; charset=utf-8",
          kie_upstream_body_format: "html_like",
          kie_upstream_parse_source: "text",
          kie_upstream_json_parsed: false,
          kie_upstream_top_level_keys: [],
          kie_upstream_data_keys: [],
          kie_upstream_has_message: false,
          kie_upstream_has_data: false,
          kie_upstream_has_download_url: false,
          kie_upstream_has_file_url: false,
        }),
      })
    );
  });

  it("returns a sanitized 500 when Kie upload setup fails unexpectedly", async () => {
    readProviderApiKeyMock.mockImplementationOnce(() => {
      throw new Error("kie key exploded");
    });
    vi.stubGlobal("fetch", vi.fn());

    const req = createMockRequest({
      headers: {
        "content-type": "image/png",
        "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        "x-shortpulse-upload-filename": "local-image.png",
      },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
    });
  });

  it("rate limits repeated Kie upload requests for the same authenticated user", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        msg: "File uploaded successfully",
        data: {
          downloadUrl: "https://tempfile.redpandaai.co/files/local-image.png",
          fileName: "local-image.png",
          mimeType: "image/png",
        },
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const buildReq = () =>
      createMockRequest({
        headers: {
          "content-type": "image/png",
          "x-shortpulse-upload-path": "shortpulse/kie-video/images",
          "x-shortpulse-upload-filename": "local-image.png",
        },
        body: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      });

    for (let attempt = 0; attempt < 24; attempt += 1) {
      const res = createMockResponse();
      await handler(buildReq() as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const res = createMockResponse();
    await handler(buildReq() as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.any(String));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({
      error: "Too many requests",
      retryAfterSeconds: expect.any(Number),
    });
  });
});
