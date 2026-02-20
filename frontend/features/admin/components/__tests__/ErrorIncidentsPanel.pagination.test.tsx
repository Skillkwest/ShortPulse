// Verifies Event Stream auto-advance behavior when display filters hide the loaded page.
import type { ComponentProps } from "react";
import { render, waitFor } from "@testing-library/react";
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
    total15mBreached: false,
    high15mBreached: false,
    generation15mBreached: false,
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
});
