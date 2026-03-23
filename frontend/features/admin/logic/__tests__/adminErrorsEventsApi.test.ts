import { describe, expect, it } from "vitest";
import {
  buildAdminErrorEventsParams,
  buildAdminErrorsParams,
  DEFAULT_ERROR_EVENTS_HEALTH,
  DEFAULT_ERROR_EVENTS_SUMMARY,
  normalizeAdminErrorEventsResponse,
  normalizeAdminErrorsResponse,
} from "../adminErrorsEventsApi";

describe("adminErrorsEventsApi", () => {
  it("builds admin incident params without all-state filters", () => {
    const params = buildAdminErrorsParams({
      page: 3,
      status: "open",
      scope: "all",
      severity: "high",
      source: "api.route",
      search: "  timeout  ",
    });

    expect(params.toString()).toBe(
      "page=3&limit=50&status=open&severity=high&source=api.route&search=timeout"
    );
  });

  it("builds admin event params without default filters", () => {
    const params = buildAdminErrorEventsParams({
      page: 2,
      scope: "generation",
      severity: "all",
      source: "all",
      synthetic: "exclude",
      signal: "provider_running_timeout",
      incident: "actionable",
      search: "  fal  ",
    });

    expect(params.toString()).toBe(
      "page=2&limit=50&scope=generation&synthetic=exclude&signal=provider_running_timeout&incident=actionable&search=fal"
    );
  });

  it("normalizes incident response payloads", () => {
    const result = normalizeAdminErrorsResponse(
      {
        errors: [
          {
            id: "err-1",
            fingerprint: "fp-1",
            source: "api.route",
            scope: "generation",
            severity: "high",
            status: "resolved",
            message: "Boom",
            stack: "stack",
            route: "/api/test",
            endpoint: "/api/test",
            request_id: "req-1",
            http_status: 502,
            user_id: "user-1",
            user_email: "user@example.com",
            metadata: { foo: "bar" },
            first_seen_at: "2026-01-01T00:00:00Z",
            last_seen_at: "2026-01-02T00:00:00Z",
            occurrences_count: 3,
          },
        ],
        summary: {
          openCount: 5,
          highSeverityOpenCount: 2,
          last24hCount: 9,
          appOpenCount: 4,
          generationOpenCount: 1,
        },
        pagination: {
          page: 3,
          perPage: 50,
          totalCount: 120,
          totalPages: 3,
          hasNextPage: false,
          hasPrevPage: true,
        },
      },
      1
    );

    expect(result.rows[0]).toMatchObject({
      id: "err-1",
      scope: "generation",
      severity: "high",
      status: "resolved",
      occurrencesCount: 3,
    });
    expect(result.summary.openCount).toBe(5);
    expect(result.pagination.page).toBe(3);
  });

  it("normalizes event response payloads and falls back to defaults", () => {
    const result = normalizeAdminErrorEventsResponse(
      {
        events: [
          {
            id: "evt-1",
            incident_id: "inc-1",
            incident_status: "ignored",
            fingerprint: "fp-1",
            source: "api.route",
            scope: "app",
            severity: "low",
            message: "Event",
            occurred_at: "2026-01-01T00:00:00Z",
            created_at: "2026-01-01T00:00:01Z",
          },
        ],
      },
      2
    );

    expect(result.rows[0]).toMatchObject({
      id: "evt-1",
      incidentStatus: "ignored",
      scope: "app",
      severity: "low",
    });
    expect(result.summary).toEqual(DEFAULT_ERROR_EVENTS_SUMMARY);
    expect(result.health).toEqual(DEFAULT_ERROR_EVENTS_HEALTH);
    expect(result.pagination.page).toBe(2);
  });
});
