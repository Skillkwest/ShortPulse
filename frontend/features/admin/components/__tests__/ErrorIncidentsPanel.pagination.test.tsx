// Verifies Event Stream auto-advance behavior when display filters hide the loaded page.
import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorIncidentsPanel } from "../ErrorIncidentsPanel";

type PanelProps = ComponentProps<typeof ErrorIncidentsPanel>;

const buildBaseProps = (): PanelProps => ({
  errors: [],
  errorsLoading: false,
  errorsError: null,
  errorSummary: {
    openCount: 0,
    highSeverityOpenCount: 0,
    last24hCount: 0,
    appOpenCount: 0,
    generationOpenCount: 0,
  },
  errorEvents: [],
  errorEventsLoading: false,
  errorEventsError: null,
  errorEventsSummary: {
    last15mCount: 0,
    high15mCount: 0,
    generation15mCount: 0,
    providerRunningTimeout15mCount: 0,
    lastHourCount: 0,
    last24hCount: 0,
    app24hCount: 0,
    generation24hCount: 0,
    high24hCount: 0,
    characterModeReferenceRefreshEmptyLastHourCount: 0,
    characterModeReferenceRefreshEmptyLast24hCount: 0,
    characterModeBundleUnavailableFallbackLastHourCount: 0,
    characterModeBundleUnavailableFallbackLast24hCount: 0,
    total15mThreshold: 40,
    high15mThreshold: 8,
    generation15mThreshold: 20,
    providerRunningTimeout15mThreshold: 2,
    total15mBreached: false,
    high15mBreached: false,
    generation15mBreached: false,
    providerRunningTimeout15mBreached: false,
  },
  errorEventsHealth: {
    eventsTableAvailable: true,
    degraded: false,
    reason: null,
  },
  errorEventsPagination: {
    page: 1,
    perPage: 50,
    totalCount: 100,
    totalPages: 2,
    hasNextPage: true,
    hasPrevPage: false,
  },
  errorStatusFilter: "open",
  errorScopeFilter: "all",
  errorSeverityFilter: "all",
  errorSourceFilter: "all",
  errorEventSyntheticFilter: "exclude",
  errorEventSignalFilter: "all",
  errorEventIncidentFilter: "actionable",
  errorSearch: "",
  errorPagination: {
    page: 1,
    perPage: 50,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
  statusUpdatingErrorId: null,
  bulkIncidentStatusUpdating: null,
  bulkIncidentStatusResult: null,
  testIncidentSubmittingScope: null,
  testIncidentResult: null,
  onErrorStatusFilterChange: vi.fn(),
  onErrorScopeFilterChange: vi.fn(),
  onErrorSeverityFilterChange: vi.fn(),
  onErrorSourceFilterChange: vi.fn(),
  onErrorEventSyntheticFilterChange: vi.fn(),
  onErrorEventSignalFilterChange: vi.fn(),
  onErrorEventIncidentFilterChange: vi.fn(),
  onErrorSearchChange: vi.fn(),
  onUpdateErrorStatus: vi.fn(async () => {}),
  onUpdateErrorEventStatus: vi.fn(async () => {}),
  onBulkUpdateListedErrorStatus: vi.fn(async () => {}),
  onTriggerTestIncident: vi.fn(),
  onPrevPage: vi.fn(),
  onNextPage: vi.fn(),
  onEventPrevPage: vi.fn(),
  onEventNextPage: vi.fn(),
  onRefresh: vi.fn(),
});

describe("ErrorIncidentsPanel event pagination", () => {
  it("auto-advances when the loaded page has no visible matches for the incident filter", async () => {
    const props = buildBaseProps();
    props.errorEvents = [
      {
        id: "evt-1",
        incidentId: "incident-1",
        incidentStatus: "resolved",
        fingerprint: "fp-1",
        source: "api.route",
        scope: "app",
        severity: "medium",
        message: "Resolved row",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: null,
        occurredAt: "2026-02-20T10:00:00.000Z",
        createdAt: "2026-02-20T10:00:00.000Z",
      },
    ];

    render(<ErrorIncidentsPanel {...props} />);

    await waitFor(() => {
      expect(props.onEventNextPage).toHaveBeenCalledTimes(1);
    });
  });

  it("does not auto-advance when incident filter is all states", async () => {
    const props = buildBaseProps();
    props.errorEventIncidentFilter = "all";
    props.errorEvents = [
      {
        id: "evt-1",
        incidentId: "incident-1",
        incidentStatus: "resolved",
        fingerprint: "fp-1",
        source: "api.route",
        scope: "app",
        severity: "medium",
        message: "Resolved row",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: null,
        occurredAt: "2026-02-20T10:00:00.000Z",
        createdAt: "2026-02-20T10:00:00.000Z",
      },
    ];

    render(<ErrorIncidentsPanel {...props} />);

    await waitFor(() => {
      expect(props.onEventNextPage).not.toHaveBeenCalled();
    });
  });

  it("routes listed-open bulk actions through the provided callback", () => {
    const props = buildBaseProps();
    props.errors = [
      {
        id: "incident-open-1",
        fingerprint: "fp-1",
        source: "api.route",
        scope: "app",
        severity: "medium",
        status: "open",
        message: "Open incident",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: null,
        firstSeenAt: "2026-02-20T10:00:00.000Z",
        lastSeenAt: "2026-02-20T10:00:00.000Z",
        occurrencesCount: 1,
      },
      {
        id: "incident-resolved-1",
        fingerprint: "fp-2",
        source: "api.route",
        scope: "app",
        severity: "medium",
        status: "resolved",
        message: "Resolved incident",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: null,
        firstSeenAt: "2026-02-20T10:00:00.000Z",
        lastSeenAt: "2026-02-20T10:00:00.000Z",
        occurrencesCount: 1,
      },
    ];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /Resolve listed open \(1\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ignore listed open \(1\)/i }));

    expect(props.onBulkUpdateListedErrorStatus).toHaveBeenCalledTimes(2);
    expect(props.onBulkUpdateListedErrorStatus).toHaveBeenNthCalledWith(1, "resolved");
    expect(props.onBulkUpdateListedErrorStatus).toHaveBeenNthCalledWith(2, "ignored");
  });

  it("routes incident row status actions through the provided callback", () => {
    const props = buildBaseProps();
    props.errors = [
      {
        id: "incident-open-row",
        fingerprint: "fp-open",
        source: "api.route",
        scope: "app",
        severity: "medium",
        status: "open",
        message: "Open incident",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: null,
        firstSeenAt: "2026-02-20T10:00:00.000Z",
        lastSeenAt: "2026-02-20T10:00:00.000Z",
        occurrencesCount: 1,
      },
      {
        id: "incident-resolved-row",
        fingerprint: "fp-resolved",
        source: "api.route",
        scope: "app",
        severity: "low",
        status: "resolved",
        message: "Resolved incident",
        stack: null,
        route: "/api/route",
        endpoint: "/api/route",
        requestId: null,
        httpStatus: 500,
        userId: "user-2",
        userEmail: "resolved@example.com",
        metadata: null,
        firstSeenAt: "2026-02-20T10:00:00.000Z",
        lastSeenAt: "2026-02-20T10:00:00.000Z",
        occurrencesCount: 1,
      },
    ];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: /^Resolve$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Reopen$/i }));

    expect(props.onUpdateErrorStatus).toHaveBeenNthCalledWith(1, "incident-open-row", "resolved");
    expect(props.onUpdateErrorStatus).toHaveBeenNthCalledWith(2, "incident-resolved-row", "open");
  });

  it("opens and closes the event detail modal from the stream table", () => {
    const props = buildBaseProps();
    props.errorEvents = [
      {
        id: "evt-view-1",
        incidentId: null,
        incidentStatus: null,
        fingerprint: "fp-view-1",
        source: "api.route",
        scope: "app",
        severity: "medium",
        message: "Viewable event",
        stack: "stack trace",
        route: "/api/route",
        endpoint: "/api/route",
        requestId: "req-1",
        httpStatus: 500,
        userId: "user-1",
        userEmail: "user@example.com",
        metadata: { attempt: 1 },
        occurredAt: "2026-02-20T10:00:00.000Z",
        createdAt: "2026-02-20T10:00:00.000Z",
      },
    ];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "View" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Event Detail")).toBeInTheDocument();
    expect(screen.getByText("stack trace")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
