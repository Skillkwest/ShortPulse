import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/fal/upload-url";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const dnsLookupMock = vi.hoisted(() => vi.fn());
const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const readProviderApiKeyMock = vi.fn();
const storageFromMock = vi.fn();
const storageDownloadMock = vi.fn();

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

vi.mock("../../lib/server/providerIntegration/providerRuntimeConfig", () => ({
  readProviderApiKey: (...args: unknown[]) => readProviderApiKeyMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    storage: {
      from: (...args: unknown[]) => storageFromMock(...args),
    },
  }),
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
    destroy: () => void;
  };
  req.method = "POST";
  req.headers = headers;
  req.destroy = vi.fn();
  setTimeout(() => {
    req.emit("data", typeof body === "string" ? Buffer.from(body) : body);
    req.emit("end");
  }, 0);
  return req;
};

describe("POST /api/fal/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    vi.unstubAllGlobals();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    readProviderApiKeyMock.mockReturnValue("fal-test-key");
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    storageFromMock.mockReturnValue({
      download: (...args: unknown[]) => storageDownloadMock(...args),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("downloads a public source and stages it on Fal CDN", async () => {
    const sourceBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
        arrayBuffer: async () => sourceBytes.buffer,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            upload_url: "https://upload.fal.media/signed-put",
            file_url: "https://v3.fal.media/files/public-image.png",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/png" }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://example.com/public-image.png",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://example.com/public-image.png");
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3"
    );
    expect(fetchMock.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Accept: "application/json",
          Authorization: "Key fal-test-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          content_type: "image/png",
          file_name: "public-image.png",
        }),
      })
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://upload.fal.media/signed-put");
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(
      expect.objectContaining({
        method: "PUT",
        headers: {
          "Content-Type": "image/png",
        },
      })
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe("https://v3.fal.media/files/public-image.png");
    expect(fetchMock.mock.calls[3]?.[1]).toEqual(
      expect.objectContaining({
        method: "HEAD",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://v3.fal.media/files/public-image.png",
      fileName: "public-image.png",
      mimeType: "image/png",
    });
  });

  it("uploads binary request bodies directly to Fal CDN", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            upload_url: "https://upload.fal.media/audio-put",
            file_url: "https://v3.fal.media/files/voice.mp3",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "audio/mpeg" }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "audio/mpeg",
        "x-shortpulse-upload-filename": "voice.mp3",
      },
      body: Buffer.from([1, 2, 3, 4]),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          content_type: "audio/mpeg",
          file_name: "voice.mp3",
        }),
      })
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://upload.fal.media/audio-put");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://v3.fal.media/files/voice.mp3");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://v3.fal.media/files/voice.mp3",
      fileName: "voice.mp3",
      mimeType: "audio/mpeg",
    });
  });

  it("stages a caller-owned storage path without using a signed source URL", async () => {
    storageDownloadMock.mockResolvedValueOnce({
      data: {
        size: 4,
        type: "audio/mpeg",
        arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
      },
      error: null,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            upload_url: "https://upload.fal.media/storage-audio-put",
            file_url: "https://v3.fal.media/files/storage-voice.mp3",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "audio/mpeg" }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-1/audio/reference-grid/voice.mp3",
        mediaKind: "audio",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(storageFromMock).toHaveBeenCalledWith("media_library");
    expect(storageDownloadMock).toHaveBeenCalledWith("user-1/audio/reference-grid/voice.mp3");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://rest.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3"
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          content_type: "audio/mpeg",
          file_name: "voice.mp3",
        }),
      })
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://upload.fal.media/storage-audio-put");
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://v3.fal.media/files/storage-voice.mp3");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://v3.fal.media/files/storage-voice.mp3",
      fileName: "voice.mp3",
      mimeType: "audio/mpeg",
    });
  });

  it("rejects storage paths outside the caller namespace before storage download", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        storagePath: "user-2/audio/reference-grid/voice.mp3",
        mediaKind: "audio",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(storageDownloadMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal upload failed",
      details: "Fal upload storage path: must start with 'user-1/'.",
    });
  });

  it("rejects local and private source URLs before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "http://localhost:3000/private.png",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal upload failed",
      details: "fileUrl cannot target a local or private-network host.",
    });
  });

  it("rejects public hostnames that resolve to private addresses", async () => {
    dnsLookupMock.mockResolvedValueOnce([{ address: "10.0.0.8", family: 4 }]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = createMockRequest({
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileUrl: "https://cdn.example.com/private-after-dns.png",
      }),
    });
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Fal upload failed",
      details: "fileUrl host resolved to a private-network address.",
    });
  });
});
