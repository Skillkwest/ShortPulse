import fs from "fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/upload-image";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

let mockFile = {
  filepath: "/tmp/mock-image",
  mimetype: "image/png",
  size: 16,
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

describe("POST /api/upload-image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "u@example.com" });
    mockFile = {
      filepath: "/tmp/mock-image",
      mimetype: "image/png",
      size: 16,
    };
    vi.spyOn(fs, "unlinkSync").mockImplementation(() => undefined);
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
      details: "Content type does not match file content.",
    });
  });
});
