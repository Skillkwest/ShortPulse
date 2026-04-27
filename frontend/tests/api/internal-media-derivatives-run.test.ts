/**
 * API tests for internal media derivative worker route auth/claim/update behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/media-derivatives/run";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const processClaimedMediaDerivativeMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/mediaDerivatives/processMediaDerivative", () => ({
  processClaimedMediaDerivative: (...args: unknown[]) => processClaimedMediaDerivativeMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

type RpcMock = ReturnType<typeof vi.fn>;

const createSupabaseMock = (rpcImpl?: RpcMock) => {
  const rpc =
    rpcImpl ??
    vi.fn(async (functionName: string) => {
      if (functionName === "claim_media_derivative_batch") {
        return {
          data: [
            {
              id: "media-1",
              user_id: "user-1",
              storage_path: "user-1/generations/images/image-1.png",
              file_type: "image",
              processing_attempts: 1,
              processing_status: "processing",
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    });
  return { rpc };
};

describe("POST /api/internal/media-derivatives/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_ENABLED = "true";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET = "derivative-secret";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_BATCH_SIZE = "10";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_MAX_ATTEMPTS = "5";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_LEASE_SECONDS = "120";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_RETRY_BASE_SECONDS = "60";
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_RETRY_MAX_SECONDS = "1800";
    processClaimedMediaDerivativeMock.mockResolvedValue({
      thumbPath: "user-1/variants/images/media-1/thumb_480",
      width: 1600,
      height: 1000,
      generatedVariants: 2,
    });
  });

  it("returns 404 when worker is disabled", async () => {
    process.env.SHORTPULSE_MEDIA_DERIVATIVES_ENABLED = "false";
    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Not found" });
  });

  it("requires cron-secret auth", async () => {
    const req = {
      method: "POST",
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("returns a misconfiguration error when enabled without any cron secret", async () => {
    delete process.env.SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET;
    delete process.env.CRON_SECRET;

    const req = {
      method: "POST",
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Derivative worker misconfigured",
      details: "Missing cron secret configuration",
    });
  });

  it("claims and processes derivatives", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ rpc: supabase.rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.rpc).toHaveBeenCalledWith("claim_media_derivative_batch", {
      p_limit: 10,
      p_max_attempts: 5,
      p_lease_seconds: 120,
    });
    expect(processClaimedMediaDerivativeMock).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledWith("mark_media_derivative_ready", {
      p_media_file_id: "media-1",
      p_user_id: "user-1",
      p_thumb_variant_path: "user-1/variants/images/media-1/thumb_480",
      p_width: 1600,
      p_height: 1000,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "scheduled",
        durationMs: expect.any(Number),
        claimed: 1,
        processed: 1,
        ready: 1,
        failed: 0,
        retryScheduled: 0,
        exhausted: 0,
        variantRowsUpserted: 2,
        errors: 0,
      })
    );
  });

  it("marks failed rows and exhausts after max attempts", async () => {
    processClaimedMediaDerivativeMock.mockRejectedValueOnce(new Error("transform failure"));
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_media_derivative_batch") {
        return {
          data: [
            {
              id: "media-2",
              user_id: "user-2",
              storage_path: "user-2/generations/images/image-2.png",
              file_type: "image",
              processing_attempts: 5,
              processing_status: "processing",
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("mark_media_derivative_failed", {
      p_media_file_id: "media-2",
      p_user_id: "user-2",
      p_error: "transform failure",
      p_retry_seconds: 960,
      p_exhausted: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "scheduled",
        ready: 0,
        failed: 1,
        retryScheduled: 0,
        exhausted: 1,
        errors: 1,
      })
    );
  });

  it("treats unsupported image format decode failures as terminal on first attempt", async () => {
    processClaimedMediaDerivativeMock.mockRejectedValueOnce(
      new Error("decode_failed: Input buffer contains unsupported image format")
    );
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_media_derivative_batch") {
        return {
          data: [
            {
              id: "media-3",
              user_id: "user-3",
              storage_path: "user-3/generations/images/image-3.png",
              file_type: "image",
              processing_attempts: 1,
              processing_status: "processing",
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("mark_media_derivative_failed", {
      p_media_file_id: "media-3",
      p_user_id: "user-3",
      p_error: "decode_failed: Input buffer contains unsupported image format",
      p_retry_seconds: 60,
      p_exhausted: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "scheduled",
        ready: 0,
        failed: 1,
        retryScheduled: 0,
        exhausted: 1,
        errors: 1,
      })
    );
  });

  it("treats unsupported input failures as terminal on first attempt", async () => {
    processClaimedMediaDerivativeMock.mockRejectedValueOnce(
      new Error("unsupported_input: invalid_source_storage_path")
    );
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_media_derivative_batch") {
        return {
          data: [
            {
              id: "media-4",
              user_id: "user-4",
              storage_path: "user-4/generations/images/image-4.png",
              file_type: "image",
              processing_attempts: 1,
              processing_status: "processing",
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("mark_media_derivative_failed", {
      p_media_file_id: "media-4",
      p_user_id: "user-4",
      p_error: "unsupported_input: invalid_source_storage_path",
      p_retry_seconds: 60,
      p_exhausted: true,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "scheduled",
        ready: 0,
        failed: 1,
        retryScheduled: 0,
        exhausted: 1,
        errors: 1,
      })
    );
  });

  it("keeps upload failures retryable before max attempts", async () => {
    processClaimedMediaDerivativeMock.mockRejectedValueOnce(new Error("upload_failed: timeout"));
    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "claim_media_derivative_batch") {
        return {
          data: [
            {
              id: "media-5",
              user_id: "user-5",
              storage_path: "user-5/generations/images/image-5.png",
              file_type: "image",
              processing_attempts: 1,
              processing_status: "processing",
            },
          ],
          error: null,
        };
      }
      return { data: true, error: null };
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("mark_media_derivative_failed", {
      p_media_file_id: "media-5",
      p_user_id: "user-5",
      p_error: "upload_failed: timeout",
      p_retry_seconds: 60,
      p_exhausted: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "scheduled",
        ready: 0,
        failed: 1,
        retryScheduled: 1,
        exhausted: 0,
        errors: 1,
      })
    );
  });

  it("labels manually triggered runs from the request header", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({ rpc: supabase.rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "derivative-secret",
        "x-shortpulse-trigger-source": "manual",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        triggerSource: "manual",
        durationMs: expect.any(Number),
        retryScheduled: 0,
      })
    );
  });
});
