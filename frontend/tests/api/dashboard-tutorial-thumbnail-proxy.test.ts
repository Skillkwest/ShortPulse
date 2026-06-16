/**
 * API tests for stable public dashboard tutorial thumbnail delivery.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/dashboard/tutorial-thumbnail";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  end: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
  send: vi.fn().mockReturnThis(),
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
});

const exactArrayBuffer = (bytes: number[]): ArrayBuffer => new Uint8Array(bytes).buffer;

describe("GET /api/dashboard/tutorial-thumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects non-GET and non-HEAD methods", async () => {
    const res = createMockResponse();

    await handler({ method: "POST", query: {} } as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, HEAD");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("rejects unsafe thumbnail storage paths before signing", async () => {
    const res = createMockResponse();

    await handler(
      {
        method: "GET",
        query: { path: "../private.env" },
      } as never,
      res as never
    );

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid thumbnail path." });
  });

  it("serves cacheable thumbnail bytes through a stable local URL", async () => {
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example.com/display.mp4" },
      error: null,
    }));
    const storageFromMock = vi.fn(() => ({ createSignedUrl: createSignedUrlMock }));
    getSupabaseAdminMock.mockReturnValue({ storage: { from: storageFromMock } });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: new Headers({ "content-type": "video/mp4" }),
        arrayBuffer: async () => exactArrayBuffer([109, 112, 52, 45, 98, 121, 116, 101, 115]),
      }))
    );
    const res = createMockResponse();

    await handler(
      {
        method: "GET",
        query: { path: "tutorial-thumbnail-variants/variant/display-cache.mp4" },
      } as never,
      res as never
    );

    expect(storageFromMock).toHaveBeenCalledWith("dashboard_tutorial_thumbnails");
    expect(createSignedUrlMock).toHaveBeenCalledWith(
      "tutorial-thumbnail-variants/variant/display-cache.mp4",
      60
    );
    expect(fetch).toHaveBeenCalledWith("https://signed.example.com/display.mp4");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800, immutable"
    );
    expect(res.setHeader).toHaveBeenCalledWith("Accept-Ranges", "bytes");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
    expect(logApiRouteExceptionMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(Buffer.isBuffer(res.send.mock.calls[0]?.[0])).toBe(true);
  });

  it("serves byte ranges for video thumbnail requests", async () => {
    const createSignedUrlMock = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example.com/display.mp4" },
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({
      storage: { from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })) },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 206,
        headers: new Headers({
          "accept-ranges": "bytes",
          "content-length": "3",
          "content-range": "bytes 1-3/5",
          "content-type": "video/mp4",
          etag: '"upstream-range-etag"',
        }),
        arrayBuffer: async () => exactArrayBuffer([2, 3, 4]),
      }))
    );
    const res = createMockResponse();

    await handler(
      {
        headers: { range: "bytes=1-3" },
        method: "GET",
        query: { path: "tutorial-thumbnail-variants/variant/display-range.mp4" },
      } as never,
      res as never
    );

    expect(fetch).toHaveBeenCalledWith("https://signed.example.com/display.mp4", {
      headers: { Range: "bytes=1-3" },
    });
    expect(res.setHeader).toHaveBeenCalledWith("Content-Range", "bytes 1-3/5");
    expect(res.setHeader).toHaveBeenCalledWith("Content-Length", "3");
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.send.mock.calls[0]?.[0]).toEqual(Buffer.from([2, 3, 4]));
  });
});
