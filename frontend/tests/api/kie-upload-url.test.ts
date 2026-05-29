import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kie/upload-url";

const dnsLookupMock = vi.hoisted(() => vi.fn());
const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const readProviderApiKeyMock = vi.fn();

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

const createMockResponse = () => ({
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
    vi.unstubAllGlobals();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    readProviderApiKeyMock.mockReturnValue("kie-test-key");
    dnsLookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("uses Kie stream upload directly for Supabase signed URLs", async () => {
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
        json: async () => ({
          msg: "File uploaded successfully",
          data: {
            downloadUrl: "https://tempfile.redpandaai.co/files/streamed-image.png",
            fileName: "streamed-image.png",
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

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://project.supabase.co/storage/v1/object/sign/media_library/user/ref.png?token=abc"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://kieai.redpandaai.co/api/file-stream-upload");
    const secondCall = fetchMock.mock.calls[1]?.[1] as { body?: FormData; headers?: HeadersInit };
    expect(secondCall.headers).toEqual(
      expect.objectContaining({
        Authorization: "Bearer kie-test-key",
      })
    );
    expect(secondCall.body).toBeInstanceOf(FormData);
    expect((secondCall.body as FormData).get("uploadPath")).toBe("shortpulse/kie-video/images");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns the Kie URL upload failure without trying a secondary upload route", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        msg: "Forbidden",
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://kieai.redpandaai.co/api/file-url-upload");
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Kie upload failed",
      details: "Forbidden",
    });
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
    const fetchMock = vi.fn().mockResolvedValueOnce({
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
