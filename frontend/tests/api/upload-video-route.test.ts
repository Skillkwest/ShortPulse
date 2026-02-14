import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-video";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

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
      details: "Content type does not match file content.",
    });
  });
});
