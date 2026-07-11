import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorIncidentsPanel } from "../ErrorIncidentsPanel";

type PanelProps = ComponentProps<typeof ErrorIncidentsPanel>;

const copyToClipboardMock = vi.fn();

vi.mock("../../logic/copyToClipboard", () => ({
  copyToClipboard: (value: string) => copyToClipboardMock(value),
}));

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
    admissionDeniedTelemetry: {
      last15m: {
        total: 0,
        byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
        byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
        byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
      },
      lastHour: {
        total: 0,
        byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
        byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
        byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
      },
      last24h: {
        total: 0,
        byTier: { video_long: 0, image_heavy: 0, image_standard: 0, unknown: 0 },
        byReason: { global_limit: 0, tier_limit: 0, global_and_tier_limit: 0, unknown: 0 },
        byScope: { per_user: 0, shared_provider: 0, unknown: 0 },
      },
    },
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
    projectWorkspaceRepairPendingLastHourCount: 0,
    projectWorkspaceRepairPendingLast24hCount: 0,
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
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
  errorIncidentViewMode: "queue",
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
  onErrorIncidentViewModeChange: vi.fn(),
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

const buildIncident = (overrides: Partial<PanelProps["errors"][number]> = {}) => ({
  id: "incident-open-row",
  fingerprint: "fp-open",
  source: "api.route",
  scope: "app" as const,
  severity: "medium" as const,
  status: "open" as const,
  message: "Open incident",
  stack: null,
  route: "/api/route",
  endpoint: "/api/route",
  requestId: "req-1",
  httpStatus: 500,
  userId: "user-1",
  userEmail: "user@example.com",
  metadata: null,
  watchItem: false,
  watchNote: null,
  watchMarkedAt: null,
  firstSeenAt: "2026-02-20T10:00:00.000Z",
  lastSeenAt: "2026-02-20T10:00:00.000Z",
  occurrencesCount: 1,
  ...overrides,
});

describe("ErrorIncidentsPanel handoff queue", () => {
  beforeEach(() => {
    copyToClipboardMock.mockReset();
    window.localStorage.clear();
  });

  it("renders the simple incident queue without event-stream controls", () => {
    const props = buildBaseProps();
    props.errors = [buildIncident()];
    props.errorPagination = {
      page: 1,
      perPage: 50,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    };

    render(<ErrorIncidentsPanel {...props} />);

    expect(
      screen.getByText("Copy one error packet, then paste it into Codex.")
    ).toBeInTheDocument();
    expect(screen.getByText("Open incident")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Queue" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "History" })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("New")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy all" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy triage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.queryByText("Event Stream")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Resolve listed open/i })).not.toBeInTheDocument();
  });

  it("marks an incident in progress after copying triage", async () => {
    copyToClipboardMock.mockResolvedValue(true);
    const props = buildBaseProps();
    props.errors = [buildIncident()];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy triage" }));

    await waitFor(() => {
      expect(screen.getByText("In progress")).toBeInTheDocument();
    });
    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
  });

  it("copies all visible incident rows, including rows already in progress", async () => {
    copyToClipboardMock.mockResolvedValue(true);
    window.localStorage.setItem(
      "shortpulse.admin.errors.in_progress_incidents",
      JSON.stringify(["incident-new-1"])
    );
    const props = buildBaseProps();
    props.errors = [
      buildIncident({ id: "incident-new-1", message: "First visible issue" }),
      buildIncident({ id: "incident-new-2", message: "Second visible issue" }),
      buildIncident({
        id: "incident-resolved",
        message: "Resolved issue",
        status: "resolved",
      }),
    ];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Copy all" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied 3" })).toBeInTheDocument();
    });

    const copiedText = String(copyToClipboardMock.mock.calls[0]?.[0] ?? "");
    expect(copiedText).toContain("First visible issue");
    expect(copiedText).toContain("Second visible issue");
    expect(copiedText).toContain("Resolved issue");
    expect(copiedText.match(/shortpulseIncidentVersion/g)).toHaveLength(3);
    expect(screen.getAllByText("In progress")).toHaveLength(2);
    expect(screen.getAllByText("Resolved")).toHaveLength(2);
  });

  it("keeps copy all enabled when every visible queue row is already in progress", async () => {
    copyToClipboardMock.mockResolvedValue(true);
    window.localStorage.setItem(
      "shortpulse.admin.errors.in_progress_incidents",
      JSON.stringify(["incident-open-row"])
    );
    const props = buildBaseProps();
    props.errors = [buildIncident()];

    render(<ErrorIncidentsPanel {...props} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy all" })).toBeEnabled();
    });
  });

  it("marks a row resolved through the incident status callback", async () => {
    const props = buildBaseProps();
    props.errors = [buildIncident()];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));

    await waitFor(() => {
      expect(props.onUpdateErrorStatus).toHaveBeenCalledWith("incident-open-row", "resolved");
    });
  });

  it("resolves a row as a watch item with a history note", async () => {
    const props = buildBaseProps();
    props.errors = [buildIncident()];

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("button", { name: "Resolve + Watch" }));
    fireEvent.change(screen.getByPlaceholderText("Add a short watch note for history"), {
      target: { value: "Provider recovered; monitor next upload." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Resolve + watch" }));

    await waitFor(() => {
      expect(props.onUpdateErrorStatus).toHaveBeenCalledWith("incident-open-row", "resolved", {
        note: "Provider recovered; monitor next upload.",
        watch: true,
      });
    });
  });

  it("shows watch markers on history rows", () => {
    const props = buildBaseProps();
    props.errorIncidentViewMode = "history";
    props.errors = [
      buildIncident({
        status: "resolved",
        message: "Resolved provider issue",
        watchItem: true,
        watchNote: "Monitor next Kie upload.",
        watchMarkedAt: "2026-02-20T11:00:00.000Z",
      }),
    ];

    render(<ErrorIncidentsPanel {...props} />);

    expect(screen.getByText("Resolved provider issue")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText(/Monitor next Kie upload/)).toBeInTheDocument();
  });

  it("shows row-level resolving state while an incident status update is pending", () => {
    const props = buildBaseProps();
    props.errors = [buildIncident()];
    props.statusUpdatingErrorId = "incident-open-row";

    render(<ErrorIncidentsPanel {...props} />);

    expect(screen.getByRole("button", { name: "Resolving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy triage" })).toBeDisabled();
  });

  it("routes search, refresh, and pagination through the provided callbacks", () => {
    const props = buildBaseProps();
    props.errorPagination = {
      page: 2,
      perPage: 50,
      totalCount: 120,
      totalPages: 3,
      hasNextPage: true,
      hasPrevPage: true,
    };

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "api.route" } });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(props.onErrorSearchChange).toHaveBeenCalledWith("api.route");
    expect(props.onRefresh).toHaveBeenCalledTimes(1);
    expect(props.onPrevPage).toHaveBeenCalledTimes(1);
    expect(props.onNextPage).toHaveBeenCalledTimes(1);
  });

  it("routes the history view toggle through the provided callback", () => {
    const props = buildBaseProps();

    render(<ErrorIncidentsPanel {...props} />);

    fireEvent.click(screen.getByRole("tab", { name: "History" }));

    expect(props.onErrorIncidentViewModeChange).toHaveBeenCalledWith("history");
  });
});
