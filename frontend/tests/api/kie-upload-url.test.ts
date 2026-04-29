import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/kie/upload-url";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const readProviderApiKeyMock = vi.fn();

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

describe("POST /api/kie/upload-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    readProviderApiKeyMock.mockReturnValue("kie-test-key");
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

    const req = {
      method: "POST",
      body: {
        fileUrl: "https://example.com/public-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      },
    };
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

    const req = {
      method: "POST",
      body: {
        fileUrl:
          "https://project.supabase.co/storage/v1/object/sign/media_library/user/ref.png?token=abc",
        uploadPath: "shortpulse/kie-video/images",
      },
    };
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

    const req = {
      method: "POST",
      body: {
        fileUrl: "https://cdn.example.com/fallback-image.jpg",
        uploadPath: "shortpulse/kie-video/images",
      },
    };
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

    const req = {
      method: "POST",
      body: {
        fileUrl: "http://127.0.0.1:54321/private.png",
        uploadPath: "shortpulse/kie-video/images",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid upload request",
      details: "fileUrl cannot target a local or private-network host.",
    });
  });
});
