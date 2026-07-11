/**
 * Badearsai Crash Logs helper contract tests.
 * Locks canonical-list RPC consumption without exercising production or review writes.
 */
import { describe, expect, it } from "vitest";
import {
  buildCanonicalListRequest,
  normalizeRow,
} from "../../../docs/agents/badearsai/tools/scripts/crash-log-intake.mjs";

describe("Badearsai crash-log intake", () => {
  it("builds a canonical list RPC request instead of duplicating table filters", () => {
    const request = buildCanonicalListRequest({
      config: { supabaseUrl: "https://example.supabase.co" },
      args: {
        limit: 50,
        status: "needs_review",
        reviewStatus: "open",
        session: null,
        route: "/ai-studio",
      },
    });

    expect(request.url.pathname).toBe("/rest/v1/rpc/list_browser_crash_sessions_v2");
    expect(request.body).toEqual({
      p_page: 1,
      p_limit: 50,
      p_status: "needs_review",
      p_review_status: "open",
      p_search: "/ai-studio",
    });
  });

  it("uses the canonical effective classification and reason returned by the RPC", () => {
    const row = normalizeRow(
      {
        id: "row-1",
        browser_session_id: "browser-session-1",
        user_id: "user-1",
        user_email: "alpha@example.com",
        status: "active",
        confidence: "none",
        effective_status: "probable_freeze_or_crash",
        effective_confidence: "high",
        effective_reason: "stale_after_extreme_absolute_heap",
        is_stale: true,
        max_used_js_heap_size: 677_380_096,
        max_heap_used_to_limit_ratio: 0.154,
        metadata: {},
      },
      { showIdentifiers: false }
    );

    expect(row).toMatchObject({
      status: "active",
      confidence: "none",
      effectiveStatus: "probable_freeze_or_crash",
      effectiveConfidence: "high",
      effectiveReason: "stale_after_extreme_absolute_heap",
      maxUsedJsHeapSize: 677_380_096,
      maxHeapUsedToLimitRatio: 0.154,
      isStale: true,
      metadata: {
        pressure: {
          usedJsHeapSize: 677_380_096,
          maxHeapUsedToLimitRatio: 0.154,
        },
      },
    });
  });

  it("treats migration-default typed zero as absent for historical heap evidence", () => {
    const row = normalizeRow(
      {
        id: "legacy-row",
        status: "active",
        confidence: "none",
        max_used_js_heap_size: 0,
        max_heap_used_to_limit_ratio: null,
        metadata: {
          used_js_heap_size: 677_380_096,
          heap_used_to_limit_ratio: 0.154,
        },
      },
      { showIdentifiers: false }
    );

    expect(row.maxUsedJsHeapSize).toBe(677_380_096);
    expect(row.metadata.pressure.usedJsHeapSize).toBe(677_380_096);
  });
});
