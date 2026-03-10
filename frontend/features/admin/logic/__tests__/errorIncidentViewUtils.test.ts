import { describe, expect, it } from "vitest";
import type { AdminErrorEventRow } from "../../types";
import {
  eventIncidentFilterLabel,
  eventMatchesIncidentFilter,
  eventSignalFilterLabel,
  formatDateTime,
  incidentStatusLabel,
  sourceLabel,
} from "../errorIncidentViewUtils";

const baseEvent = (overrides: Partial<AdminErrorEventRow>): AdminErrorEventRow => ({
  id: "evt-1",
  incidentId: "inc-1",
  incidentStatus: "open",
  fingerprint: "fp-1",
  source: "api.test",
  scope: "app",
  severity: "medium",
  message: "Message",
  stack: null,
  route: "/api/test",
  endpoint: "/api/test",
  requestId: null,
  httpStatus: 500,
  userId: null,
  userEmail: null,
  metadata: null,
  occurredAt: "2026-02-27T00:00:00.000Z",
  createdAt: "2026-02-27T00:00:00.000Z",
  ...overrides,
});

describe("errorIncidentViewUtils", () => {
  it("handles date formatting fallbacks", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatDateTime("not-a-date")).toBe("—");
  });

  it("builds source labels from dot notation", () => {
    expect(sourceLabel("telemetry.character_mode")).toBe("Telemetry · Character_mode");
  });

  it("returns stable labels for signal and incident filters", () => {
    expect(eventSignalFilterLabel("all")).toBe("All event signals");
    expect(eventSignalFilterLabel("character_mode_reference_refresh_empty")).toContain(
      "reference refresh empty"
    );
    expect(eventSignalFilterLabel("provider_running_timeout")).toContain("running timeout");
    expect(eventIncidentFilterLabel("actionable")).toContain("Actionable");
    expect(eventIncidentFilterLabel("unlinked")).toContain("Unlinked");
  });

  it("evaluates incident filter matching correctly", () => {
    const openLinked = baseEvent({ incidentId: "inc-1", incidentStatus: "open" });
    const resolvedLinked = baseEvent({ incidentId: "inc-1", incidentStatus: "resolved" });
    const unlinked = baseEvent({ incidentId: null, incidentStatus: null });

    expect(eventMatchesIncidentFilter(openLinked, "all")).toBe(true);
    expect(eventMatchesIncidentFilter(openLinked, "open")).toBe(true);
    expect(eventMatchesIncidentFilter(resolvedLinked, "resolved")).toBe(true);
    expect(eventMatchesIncidentFilter(unlinked, "unlinked")).toBe(true);
    expect(eventMatchesIncidentFilter(unlinked, "actionable")).toBe(true);
    expect(eventMatchesIncidentFilter(resolvedLinked, "actionable")).toBe(false);
  });

  it("formats incident status labels", () => {
    expect(incidentStatusLabel("open")).toBe("Open");
    expect(incidentStatusLabel("resolved")).toBe("Resolved");
    expect(incidentStatusLabel("ignored")).toBe("Ignored");
    expect(incidentStatusLabel(null)).toBe("Unlinked");
  });
});
