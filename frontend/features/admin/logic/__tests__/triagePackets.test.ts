/**
 * Regression tests for admin triage packet clipboard payloads.
 */

import { describe, expect, it } from "vitest";
import type { AdminErrorEventRow, AdminErrorLogRow } from "../../types";
import { buildEventTriagePacket, buildIncidentTriagePacket } from "../triagePackets";

describe("triagePackets", () => {
  it("builds a compact incident triage packet without raw metadata payload", () => {
    const breadcrumbs = Array.from({ length: 20 }, (_, index) => ({
      t: 1771250000000 + index,
      type: "network",
      level: "info",
      message: "fetch",
      data: `payload-${index}-${"x".repeat(420)}`,
    }));
    const row: AdminErrorLogRow = {
      id: "inc-1",
      fingerprint: "fp-1",
      source: "client.api_response",
      scope: "app",
      severity: "high",
      status: "open",
      message: "API 500 response from /api/admin/errors?page=1&limit=50&status=open",
      stack: "ReferenceError: broken",
      route: "/admin",
      endpoint: "/api/admin/errors?page=1&limit=50&status=open",
      requestId: "req-1",
      httpStatus: 500,
      userId: "user-1",
      userEmail: "admin@example.com",
      metadata: {
        build_id: "development",
        session_id: "session-1",
        client_environment: "development",
        breadcrumbs,
      },
      firstSeenAt: "2026-02-16T13:43:23.863+00:00",
      lastSeenAt: "2026-02-16T13:44:23.863+00:00",
      occurrencesCount: 5,
    };

    const payload = JSON.parse(buildIncidentTriagePacket(row)) as {
      shortpulseIncidentVersion: number;
      packetType: string;
      incident: {
        id: string;
        triage: {
          buildId: string | null;
          sessionId: string | null;
          metadataKeys: string[];
          breadcrumbs: Array<{ data: string | null }>;
        };
        metadata?: unknown;
      };
    };

    expect(payload.shortpulseIncidentVersion).toBe(3);
    expect(payload.packetType).toBe("triage");
    expect(payload.incident.id).toBe("inc-1");
    expect(payload.incident.metadata).toBeUndefined();
    expect(payload.incident.triage.buildId).toBe("development");
    expect(payload.incident.triage.sessionId).toBe("session-1");
    expect(payload.incident.triage.metadataKeys).toContain("breadcrumbs");
    expect(payload.incident.triage.breadcrumbs).toHaveLength(12);
    const breadcrumbData = payload.incident.triage.breadcrumbs[0]?.data ?? "";
    expect(breadcrumbData.length).toBeLessThanOrEqual(401);
    expect(breadcrumbData.endsWith("…")).toBe(true);
  });

  it("builds an event triage packet with bounded stack and null-safe metadata handling", () => {
    const row: AdminErrorEventRow = {
      id: "evt-1",
      incidentId: null,
      incidentStatus: null,
      fingerprint: "fp-2",
      source: "client.runtime",
      scope: "app",
      severity: "high",
      message: "clearVisibleEvents is not defined",
      stack: `ReferenceError: clearVisibleEvents is not defined\n${"line\n".repeat(2000)}`,
      route: "/admin",
      endpoint: null,
      requestId: null,
      httpStatus: 0,
      userId: "user-1",
      userEmail: "admin@example.com",
      metadata: null,
      occurredAt: "2026-02-16T14:46:31.682+00:00",
      createdAt: "2026-02-16T14:46:32.349011+00:00",
    };

    const payload = JSON.parse(buildEventTriagePacket(row)) as {
      shortpulseEventVersion: number;
      packetType: string;
      event: {
        incidentStatus: string | null;
        stack: string | null;
        triage: {
          metadataKeys: string[];
          breadcrumbs: unknown[];
        };
      };
    };

    expect(payload.shortpulseEventVersion).toBe(2);
    expect(payload.packetType).toBe("triage");
    expect(payload.event.incidentStatus).toBeNull();
    expect(payload.event.triage.metadataKeys).toEqual([]);
    expect(payload.event.triage.breadcrumbs).toEqual([]);
    expect(payload.event.stack).not.toBeNull();
    expect((payload.event.stack ?? "").length).toBeLessThanOrEqual(8001);
    expect((payload.event.stack ?? "").endsWith("…")).toBe(true);
  });
});
