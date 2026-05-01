import { describe, expect, it } from "vitest";
import {
  parseIncidentIdFromDetails,
  redactText,
  redactedMetadataSummary,
  redactedStackLines,
  toEventDetail,
} from "../../scripts/ophestivus_error_event_detail.mjs";

describe("ophestivus error event detail helper", () => {
  it("parses incident ids from compact ticket details", () => {
    expect(
      parseIncidentIdFromDetails(
        "Incident: c3c6658a-993a-4515-bbb5-0cc0df68b67a\nIssue: PricingCatalogSections is not defined"
      )
    ).toBe("c3c6658a-993a-4515-bbb5-0cc0df68b67a");
  });

  it("redacts emails and token-like values from text", () => {
    const redacted = redactText(
      "user admin@example.com failed with Bearer abc.def?access_token=secret&keep=yes",
      500
    );

    expect(redacted).toContain("[redacted-email]");
    expect(redacted).toContain("Bearer [redacted]");
    expect(redacted).toContain("access_token=[redacted]");
    expect(redacted).toContain("keep=yes");
  });

  it("summarizes metadata without session ids or raw breadcrumb payloads", () => {
    const summary = redactedMetadataSummary({
      host: "localhost:3000",
      app_environment: "preview",
      client_environment: "development",
      visibility_state: "visible",
      build_id: "development",
      session_id: "private-session",
      breadcrumbs: [
        {
          type: "network",
          level: "info",
          message: "fetch",
          data: JSON.stringify({
            method: "GET",
            endpoint: "/api/admin/pricing/state?token=private",
            status: 200,
            duration_ms: 42,
          }),
        },
      ],
    });

    expect(summary).toMatchObject({
      host: "localhost:3000",
      appEnvironment: "preview",
      clientEnvironment: "development",
      visibilityState: "visible",
      buildId: "development",
      breadcrumbCount: 1,
    });
    expect(summary).not.toHaveProperty("session_id");
    expect(summary.breadcrumbs[0]).toMatchObject({
      endpoint: "/api/admin/pricing/state?token=[redacted]",
      method: "GET",
      status: 200,
      durationMs: 42,
    });
  });

  it("limits and redacts stack lines", () => {
    const lines = redactedStackLines(
      [
        "ReferenceError: PricingCatalogSections is not defined",
        "at AdminPricingPage admin@example.com",
        "at Object.performReactRefresh token=secret",
      ].join("\n"),
      2
    );

    expect(lines).toEqual([
      "ReferenceError: PricingCatalogSections is not defined",
      "at AdminPricingPage [redacted-email]",
    ]);
  });

  it("builds redacted event details", () => {
    const event = toEventDetail(
      {
        id: "event-1",
        incident_id: "incident-1",
        fingerprint: "fingerprint-1",
        source: "client.runtime",
        scope: "app",
        severity: "high",
        message: "PricingCatalogSections is not defined",
        stack: "ReferenceError: PricingCatalogSections is not defined\nat applyUpdate",
        route: "/admin/pricing",
        endpoint: null,
        request_id: null,
        http_status: null,
        metadata: {
          host: "localhost:3000",
          client_environment: "development",
          visibility_state: "visible",
        },
        occurred_at: "2026-05-01T21:00:00Z",
        created_at: "2026-05-01T21:00:01Z",
      },
      { stackLines: 1 }
    );

    expect(event).toMatchObject({
      id: "event-1",
      incidentId: "incident-1",
      message: "PricingCatalogSections is not defined",
      route: "/admin/pricing",
      stackFirstLines: ["ReferenceError: PricingCatalogSections is not defined"],
      metadata: {
        host: "localhost:3000",
        clientEnvironment: "development",
        visibilityState: "visible",
      },
    });
  });
});
