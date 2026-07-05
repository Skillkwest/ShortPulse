/**
 * Admin crash-session API client tests.
 * Locks query construction and response normalization for `/admin/crashes`.
 */
import { describe, expect, it } from "vitest";
import {
  buildAdminCrashSessionsParams,
  normalizeAdminCrashSessionsResponse,
} from "../adminCrashSessionsApi";

describe("adminCrashSessionsApi", () => {
  it("builds bounded admin crash-session query params", () => {
    const params = buildAdminCrashSessionsParams({
      page: 3,
      status: "probable_freeze_or_crash",
      search: " alpha@example.com ",
    });

    expect(params.toString()).toBe(
      "page=3&limit=50&status=probable_freeze_or_crash&search=alpha%40example.com"
    );
  });

  it("omits all-status and blank search filters", () => {
    const params = buildAdminCrashSessionsParams({
      status: "all",
      search: "   ",
    });

    expect(params.toString()).toBe("page=1&limit=50");
  });

  it("normalizes snake-case crash-session rows and derived stale status", () => {
    const result = normalizeAdminCrashSessionsResponse({
      sessions: [
        {
          id: "row-1",
          browser_session_id: "browser-session-1",
          user_id: "user-1",
          user_email: "alpha@example.com",
          status: "active",
          confidence: "none",
          effective_status: "possible_ungraceful_exit",
          effective_confidence: "low",
          is_stale: true,
          last_event: "heartbeat",
          route: "/ai-studio?tab=secret",
          build_id: "build-1",
          client_environment: "production",
          user_agent: "Mozilla Chrome/120",
          metadata: { pressure_level: 4 },
          started_at: "2026-07-05T01:00:00.000Z",
          last_seen_at: "2026-07-05T01:02:00.000Z",
        },
      ],
      pagination: {
        page: 1,
        perPage: 50,
        totalCount: 1,
        totalPages: 1,
      },
    });

    expect(result.rows[0]).toMatchObject({
      id: "row-1",
      browserSessionId: "browser-session-1",
      userId: "user-1",
      userEmail: "alpha@example.com",
      status: "active",
      confidence: "none",
      effectiveStatus: "possible_ungraceful_exit",
      effectiveConfidence: "low",
      isStale: true,
      metadata: { pressure_level: 4 },
    });
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPrevPage).toBe(false);
  });
});
