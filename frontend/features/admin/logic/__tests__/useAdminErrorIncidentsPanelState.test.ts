import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorLogRow,
  AdminPagination,
} from "../../types";
import { useAdminErrorIncidentsPanelState } from "../useAdminErrorIncidentsPanelState";

const copyToClipboardMock = vi.fn();

vi.mock("../copyToClipboard", () => ({
  copyToClipboard: (value: string) => copyToClipboardMock(value),
}));

const basePagination: AdminPagination = {
  page: 1,
  perPage: 50,
  totalCount: 100,
  totalPages: 2,
  hasNextPage: true,
  hasPrevPage: false,
};

const buildIncident = (overrides: Partial<AdminErrorLogRow> = {}): AdminErrorLogRow => ({
  id: "incident-1",
  fingerprint: "fingerprint-1",
  source: "api.route",
  scope: "app",
  severity: "medium",
  status: "open",
  message: "Incident message",
  stack: null,
  route: "/api/route",
  endpoint: "/api/route",
  requestId: null,
  httpStatus: 500,
  userId: "user-1",
  userEmail: "user@example.com",
  metadata: null,
  watchItem: false,
  watchNote: null,
  watchMarkedAt: null,
  firstSeenAt: "2026-02-20T10:00:00.000Z",
  lastSeenAt: "2026-02-20T10:05:00.000Z",
  occurrencesCount: 1,
  ...overrides,
});

const buildEvent = (overrides: Partial<AdminErrorEventRow> = {}): AdminErrorEventRow => ({
  id: "event-1",
  incidentId: "incident-1",
  incidentStatus: "open",
  fingerprint: "fingerprint-1",
  source: "api.route",
  scope: "app",
  severity: "medium",
  message: "Event message",
  stack: null,
  route: "/api/route",
  endpoint: "/api/route",
  requestId: null,
  httpStatus: 500,
  userId: "user-1",
  userEmail: "user@example.com",
  metadata: { attempt: 1 },
  occurredAt: "2026-02-20T10:00:00.000Z",
  createdAt: "2026-02-20T10:00:00.000Z",
  ...overrides,
});

type HookParams = {
  errors?: AdminErrorLogRow[];
  errorEvents?: AdminErrorEventRow[];
  errorEventsLoading?: boolean;
  errorEventsPagination?: AdminPagination;
  errorEventIncidentFilter?: AdminErrorEventIncidentFilter;
  onEventNextPage?: () => void;
  onUpdateErrorStatus?: (
    errorId: string,
    status: "open" | "resolved" | "ignored",
    options?: { note?: string; watch?: boolean }
  ) => Promise<void>;
  onUpdateErrorEventStatus?: (
    eventId: string,
    status: "open" | "resolved" | "ignored",
    options?: { note?: string; watch?: boolean }
  ) => Promise<void>;
};

const buildParams = (overrides: HookParams = {}) => ({
  errors: overrides.errors ?? [],
  errorEvents: overrides.errorEvents ?? [],
  errorEventsLoading: overrides.errorEventsLoading ?? false,
  errorEventsPagination: overrides.errorEventsPagination ?? basePagination,
  errorEventIncidentFilter: overrides.errorEventIncidentFilter ?? "actionable",
  onEventNextPage: overrides.onEventNextPage ?? vi.fn(),
  onUpdateErrorStatus: overrides.onUpdateErrorStatus ?? vi.fn(async () => {}),
  onUpdateErrorEventStatus: overrides.onUpdateErrorEventStatus ?? vi.fn(async () => {}),
});

describe("useAdminErrorIncidentsPanelState", () => {
  beforeEach(() => {
    copyToClipboardMock.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives source options and auto-advances only once for the current page", async () => {
    const onEventNextPage = vi.fn();
    const params = buildParams({
      errors: [buildIncident({ source: "runtime.web" })],
      errorEvents: [buildEvent({ incidentStatus: "resolved", source: "api.route" })],
      onEventNextPage,
    });

    const { result, rerender } = renderHook(
      (nextParams) => useAdminErrorIncidentsPanelState(nextParams),
      {
        initialProps: params,
      }
    );

    await waitFor(() => {
      expect(onEventNextPage).toHaveBeenCalledTimes(1);
    });
    expect(result.current.errorSourceOptions).toEqual(["all", "api.route", "runtime.web"]);

    rerender(params);

    await waitFor(() => {
      expect(onEventNextPage).toHaveBeenCalledTimes(1);
    });
  });

  it("routes linked and unlinked event actions to the correct mutations", async () => {
    const onUpdateErrorStatus = vi.fn(async () => {});
    const onUpdateErrorEventStatus = vi.fn(async () => {});
    const linkedEvent = buildEvent({
      id: "event-linked",
      incidentId: "incident-open",
      incidentStatus: "open",
    });
    const unlinkedEvent = buildEvent({
      id: "event-unlinked",
      incidentId: null,
      incidentStatus: null,
    });

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(
        buildParams({
          errorEvents: [linkedEvent, unlinkedEvent],
          onUpdateErrorStatus,
          onUpdateErrorEventStatus,
        })
      )
    );

    await act(async () => {
      await result.current.handleResolveEventRow(linkedEvent);
      await result.current.handleIgnoreEventRow(unlinkedEvent);
    });

    expect(onUpdateErrorStatus).toHaveBeenCalledWith("incident-open", "resolved");
    expect(onUpdateErrorEventStatus).toHaveBeenCalledWith("event-unlinked", "ignored");
  });

  it("bulk resolves visible open incidents and unlinked events", async () => {
    const onUpdateErrorStatus = vi.fn(async () => {});
    const onUpdateErrorEventStatus = vi.fn(async () => {});

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(
        buildParams({
          errorEvents: [
            buildEvent({ id: "event-open-1", incidentId: "incident-1", incidentStatus: "open" }),
            buildEvent({ id: "event-open-2", incidentId: "incident-1", incidentStatus: "open" }),
            buildEvent({ id: "event-unlinked", incidentId: null, incidentStatus: null }),
            buildEvent({
              id: "event-resolved",
              incidentId: "incident-2",
              incidentStatus: "resolved",
            }),
          ],
          onUpdateErrorStatus,
          onUpdateErrorEventStatus,
        })
      )
    );

    await act(async () => {
      await result.current.resolveVisibleEvents();
    });

    expect(onUpdateErrorStatus).toHaveBeenCalledTimes(1);
    expect(onUpdateErrorStatus).toHaveBeenCalledWith("incident-1", "resolved");
    expect(onUpdateErrorEventStatus).toHaveBeenCalledTimes(1);
    expect(onUpdateErrorEventStatus).toHaveBeenCalledWith("event-unlinked", "resolved");
    expect(result.current.bulkResolveResult).toBe(
      "Resolved 1 linked incident and resolved 1 unlinked event."
    );
  });

  it("does not promote routine telemetry when resolving visible events", async () => {
    const onUpdateErrorStatus = vi.fn(async () => {});
    const onUpdateErrorEventStatus = vi.fn(async () => {});

    const routineTelemetryEvent = buildEvent({
      id: "event-routine-telemetry",
      incidentId: null,
      incidentStatus: null,
      source: "telemetry.ai_studio.stability.window_focus",
    });

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(
        buildParams({
          errorEvents: [
            buildEvent({ id: "event-open", incidentId: "incident-open", incidentStatus: "open" }),
            routineTelemetryEvent,
          ],
          errorEventIncidentFilter: "unlinked",
          onUpdateErrorStatus,
          onUpdateErrorEventStatus,
        })
      )
    );

    expect(result.current.resolveVisibleTargetCount).toBe(0);

    await act(async () => {
      await result.current.handleResolveEventRow(routineTelemetryEvent);
      await result.current.handleIgnoreEventRow(routineTelemetryEvent);
      await result.current.resolveVisibleEvents();
    });

    expect(onUpdateErrorStatus).not.toHaveBeenCalled();
    expect(onUpdateErrorEventStatus).not.toHaveBeenCalled();
  });

  it("tracks copied incident state and clears it after the timeout", async () => {
    vi.useFakeTimers();
    copyToClipboardMock.mockResolvedValue(true);
    const incident = buildIncident();

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(buildParams({ errors: [incident] }))
    );

    await act(async () => {
      await result.current.handleCopyIncident(incident);
    });
    expect(result.current.copiedIncidentId).toBe("incident-1");

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    expect(result.current.copiedIncidentId).toBeNull();
    expect(result.current.inProgressIncidentIds.has("incident-1")).toBe(true);
  });

  it("copies every visible incident packet and marks open rows in progress", async () => {
    copyToClipboardMock.mockResolvedValue(true);
    window.localStorage.setItem(
      "shortpulse.admin.errors.in_progress_incidents",
      JSON.stringify(["incident-in-progress"])
    );
    const firstNewIncident = buildIncident({ id: "incident-new-1", message: "First new issue" });
    const secondNewIncident = buildIncident({
      id: "incident-new-2",
      message: "Second new issue",
    });
    const inProgressIncident = buildIncident({
      id: "incident-in-progress",
      message: "Already copied issue",
    });
    const resolvedIncident = buildIncident({
      id: "incident-resolved",
      message: "Resolved issue",
      status: "resolved",
    });

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(
        buildParams({
          errors: [firstNewIncident, secondNewIncident, inProgressIncident, resolvedIncident],
        })
      )
    );

    await waitFor(() => {
      expect(result.current.visibleIncidentCount).toBe(4);
    });

    await act(async () => {
      await result.current.handleCopyVisibleIncidents();
    });

    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    const copiedText = String(copyToClipboardMock.mock.calls[0]?.[0] ?? "");
    expect(copiedText).toContain("First new issue");
    expect(copiedText).toContain("Second new issue");
    expect(copiedText).toContain("Already copied issue");
    expect(copiedText).toContain("Resolved issue");
    expect(copiedText.match(/shortpulseIncidentVersion/g)).toHaveLength(4);
    expect(copiedText).toContain("---");
    expect(result.current.copiedVisibleIncidentCount).toBe(4);
    expect(result.current.visibleIncidentCount).toBe(4);
    expect(result.current.inProgressIncidentIds.has("incident-new-1")).toBe(true);
    expect(result.current.inProgressIncidentIds.has("incident-new-2")).toBe(true);
    expect(result.current.inProgressIncidentIds.has("incident-in-progress")).toBe(true);
  });

  it("does not mark visible incidents in progress when bulk clipboard copy fails", async () => {
    copyToClipboardMock.mockResolvedValue(false);
    const incident = buildIncident({ id: "incident-copy-failure" });

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(buildParams({ errors: [incident] }))
    );

    expect(result.current.visibleIncidentCount).toBe(1);

    await act(async () => {
      await result.current.handleCopyVisibleIncidents();
    });

    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    expect(result.current.copiedVisibleIncidentCount).toBeNull();
    expect(result.current.visibleIncidentCount).toBe(1);
    expect(result.current.inProgressIncidentIds.has("incident-copy-failure")).toBe(false);
    expect(window.localStorage.getItem("shortpulse.admin.errors.in_progress_incidents")).toBeNull();
  });

  it("closes the selected event when Escape is pressed", async () => {
    const event = buildEvent({ id: "event-escape" });

    const { result } = renderHook(() =>
      useAdminErrorIncidentsPanelState(buildParams({ errorEvents: [event] }))
    );

    act(() => {
      result.current.openSelectedEvent("event-escape");
    });
    expect(result.current.selectedEvent?.id).toBe("event-escape");
    expect(result.current.eventMetadataText).toContain('"attempt": 1');

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });

    await waitFor(() => {
      expect(result.current.selectedEvent).toBeNull();
    });
  });
});
