/**
 * API tests for media storage lifecycle dry-run route safety and RPC behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/media-storage-lifecycle/run";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/internal/media-storage-lifecycle/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_ENABLED = "true";
    process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_CRON_SECRET = "storage-secret";
    process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_TTL_DAYS = "14";
    delete process.env.CRON_SECRET;
  });

  it("returns 404 when lifecycle dry run is disabled", async () => {
    process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_ENABLED = "false";
    const req = {
      method: "POST",
      headers: { "x-shortpulse-cron-secret": "storage-secret" },
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

  it("rejects non-dry-run modes", async () => {
    const req = {
      method: "POST",
      headers: { "x-shortpulse-cron-secret": "storage-secret" },
      body: { mode: "delete" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unsupported lifecycle mode",
      details: "This route currently supports dry_run only.",
    });
  });

  it("returns a misconfiguration error when enabled without any cron secret", async () => {
    delete process.env.SHORTPULSE_MEDIA_STORAGE_LIFECYCLE_CRON_SECRET;
    delete process.env.CRON_SECRET;
    const req = {
      method: "POST",
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media storage lifecycle worker misconfigured",
      details: "Missing cron secret configuration",
    });
  });

  it("calls the aggregate lifecycle RPC and returns totals without raw paths", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          manifest_action: "delete_candidate",
          manifest_reason: "unreferenced staged upload older than TTL",
          safe_path_class: "media_library/upload_staging_reference_image",
          object_count: 2,
          objects_missing_size_metadata: 0,
          total_mb: "5.25",
          oldest_object_created_at: "2026-06-01T00:00:00.000Z",
          newest_object_created_at: "2026-06-02T00:00:00.000Z",
          youngest_age_days: 29,
          oldest_age_days: 30,
        },
        {
          manifest_action: "manual_review_required",
          manifest_reason: "voice source namespace requires workflow/custom-voice review",
          safe_path_class: "media_library/voice_changer_source_audio",
          object_count: "3",
          objects_missing_size_metadata: 1,
          total_mb: "9.75",
          oldest_object_created_at: null,
          newest_object_created_at: null,
          youngest_age_days: null,
          oldest_age_days: null,
        },
      ],
      error: null,
    }));
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "storage-secret",
        "x-shortpulse-trigger-source": "manual",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpc).toHaveBeenCalledWith("get_media_storage_lifecycle_summary", {
      p_cleanup_ttl_days: 14,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      mode: "dry_run",
      triggerSource: "manual",
      durationMs: expect.any(Number),
      cleanupTtlDays: 14,
      totals: {
        objectCount: 5,
        totalMb: 15,
        deleteCandidateCount: 2,
        deleteCandidateMb: 5.25,
        manualReviewCount: 3,
        manualReviewMb: 9.75,
        integrityProblemCount: 0,
        integrityProblemMb: 0,
      },
      rows: [
        {
          manifestAction: "delete_candidate",
          manifestReason: "unreferenced staged upload older than TTL",
          safePathClass: "media_library/upload_staging_reference_image",
          objectCount: 2,
          objectsMissingSizeMetadata: 0,
          totalMb: 5.25,
          oldestObjectCreatedAt: "2026-06-01T00:00:00.000Z",
          newestObjectCreatedAt: "2026-06-02T00:00:00.000Z",
          youngestAgeDays: 29,
          oldestAgeDays: 30,
        },
        {
          manifestAction: "manual_review_required",
          manifestReason: "voice source namespace requires workflow/custom-voice review",
          safePathClass: "media_library/voice_changer_source_audio",
          objectCount: 3,
          objectsMissingSizeMetadata: 1,
          totalMb: 9.75,
          oldestObjectCreatedAt: null,
          newestObjectCreatedAt: null,
          youngestAgeDays: null,
          oldestAgeDays: null,
        },
      ],
    });
  });

  it("logs and returns a stable error when the RPC fails", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "permission denied for function" },
    }));
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const req = {
      method: "POST",
      headers: { "x-shortpulse-cron-secret": "storage-secret" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/media-storage-lifecycle/run",
        metadata: { cleanupTtlDays: 14 },
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Media storage lifecycle dry run failed",
      details: "permission denied for function",
    });
  });
});
