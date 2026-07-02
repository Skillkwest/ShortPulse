import React from "react";
import type {
  AdminErrorEventIncidentFilter,
  AdminErrorEventRow,
  AdminErrorLogRow,
  AdminPagination,
  AdminErrorStatus,
} from "../types";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { copyToClipboard } from "./copyToClipboard";
import { normalizeAdminErrorEventRow } from "./adminErrorsEventsApi";
import { eventMatchesIncidentFilter } from "./errorIncidentViewUtils";
import { buildEventTriagePacket, buildIncidentTriagePacket } from "./triagePackets";

type UseAdminErrorIncidentsPanelStateParams = {
  errors: AdminErrorLogRow[];
  errorEvents: AdminErrorEventRow[];
  errorEventsLoading: boolean;
  errorEventsPagination: AdminPagination;
  errorEventIncidentFilter: AdminErrorEventIncidentFilter;
  onEventNextPage: () => void;
  onUpdateErrorStatus: (errorId: string, status: AdminErrorStatus) => Promise<void>;
  onUpdateErrorEventStatus: (eventId: string, status: AdminErrorStatus) => Promise<void>;
};

type UseAdminErrorIncidentsPanelStateResult = {
  copiedIncidentId: string | null;
  copiedEventId: string | null;
  selectedEventId: string | null;
  selectedEvent: AdminErrorEventRow | null;
  selectedIncidentId: string | null;
  errorSourceOptions: string[];
  visibleEvents: AdminErrorEventRow[];
  listedOpenIncidentCount: number;
  resolveVisibleTargetCount: number;
  bulkResolveSubmitting: boolean;
  bulkResolveResult: string | null;
  eventMetadataText: string;
  openSelectedEvent: (eventId: string) => void;
  closeSelectedEvent: () => void;
  handleCopyIncident: (row: AdminErrorLogRow) => Promise<void>;
  handleCopyEvent: (row: AdminErrorEventRow) => Promise<void>;
  handleResolveEventRow: (row: AdminErrorEventRow) => Promise<void>;
  handleIgnoreEventRow: (row: AdminErrorEventRow) => Promise<void>;
  resolveVisibleEvents: () => Promise<void>;
};

export const useAdminErrorIncidentsPanelState = ({
  errors,
  errorEvents,
  errorEventsLoading,
  errorEventsPagination,
  errorEventIncidentFilter,
  onEventNextPage,
  onUpdateErrorStatus,
  onUpdateErrorEventStatus,
}: UseAdminErrorIncidentsPanelStateParams): UseAdminErrorIncidentsPanelStateResult => {
  const [copiedIncidentId, setCopiedIncidentId] = React.useState<string | null>(null);
  const [copiedEventId, setCopiedEventId] = React.useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
  const [eventDetailsById, setEventDetailsById] = React.useState<
    Record<string, AdminErrorEventRow>
  >({});
  const [bulkResolveSubmitting, setBulkResolveSubmitting] = React.useState(false);
  const [bulkResolveResult, setBulkResolveResult] = React.useState<string | null>(null);
  const autoAdvancedEventPageRef = React.useRef<number | null>(null);

  const errorSourceOptions = React.useMemo(() => {
    const values = new Set([
      ...errors.map((row) => row.source),
      ...errorEvents.map((row) => row.source),
    ]);
    return ["all", ...Array.from(values).sort()];
  }, [errorEvents, errors]);

  const visibleEvents = React.useMemo(
    () => errorEvents.filter((row) => eventMatchesIncidentFilter(row, errorEventIncidentFilter)),
    [errorEventIncidentFilter, errorEvents]
  );

  const selectedEvent = React.useMemo(() => {
    if (!selectedEventId) return null;
    return (
      eventDetailsById[selectedEventId] ??
      errorEvents.find((row) => row.id === selectedEventId) ??
      null
    );
  }, [errorEvents, eventDetailsById, selectedEventId]);
  const selectedIncidentId = selectedEvent?.incidentId ?? null;

  const resolvableVisibleIncidentIds = React.useMemo(
    () =>
      Array.from(
        new Set(
          visibleEvents
            .map((row) => (row.incidentStatus === "open" ? row.incidentId : null))
            .filter((incidentId): incidentId is string => Boolean(incidentId))
        )
      ),
    [visibleEvents]
  );

  const resolvableVisibleUnlinkedEventIds = React.useMemo(
    () => visibleEvents.filter((row) => row.incidentId === null).map((row) => row.id),
    [visibleEvents]
  );

  const resolveVisibleTargetCount =
    resolvableVisibleIncidentIds.length + resolvableVisibleUnlinkedEventIds.length;

  const listedOpenIncidentCount = React.useMemo(
    () => errors.filter((row) => row.status === "open").length,
    [errors]
  );

  const eventMetadataText = React.useMemo(() => {
    if (!selectedEvent) return "";
    return JSON.stringify(selectedEvent.metadata ?? {}, null, 2);
  }, [selectedEvent]);

  const handleCopyIncident = React.useCallback(async (row: AdminErrorLogRow) => {
    const success = await copyToClipboard(buildIncidentTriagePacket(row));
    if (!success) return;
    setCopiedIncidentId(row.id);
    window.setTimeout(() => {
      setCopiedIncidentId((current) => (current === row.id ? null : current));
    }, 1200);
  }, []);

  const loadEventDetail = React.useCallback(
    async (eventId: string): Promise<AdminErrorEventRow | null> => {
      const cached = eventDetailsById[eventId];
      if (cached) return cached;

      const listRow = errorEvents.find((row) => row.id === eventId) ?? null;
      if (listRow && (listRow.stack !== null || listRow.metadata !== null)) {
        return listRow;
      }

      const params = new URLSearchParams({ eventId });
      const response = await fetchWithAuth(`/api/admin/error-events?${params.toString()}`, {
        method: "GET",
      });
      if (!response.ok) return listRow;

      const data = (await response.json().catch(() => ({}))) as { event?: unknown };
      if (!data.event) return listRow;

      const detail = normalizeAdminErrorEventRow(data.event);
      setEventDetailsById((current) => ({ ...current, [detail.id]: detail }));
      return detail;
    },
    [errorEvents, eventDetailsById]
  );

  const handleCopyEvent = React.useCallback(
    async (row: AdminErrorEventRow) => {
      const detail = (await loadEventDetail(row.id)) ?? row;
      const success = await copyToClipboard(buildEventTriagePacket(detail));
      if (!success) return;
      setCopiedEventId(row.id);
      window.setTimeout(() => {
        setCopiedEventId((current) => (current === row.id ? null : current));
      }, 1200);
    },
    [loadEventDetail]
  );

  const handleEventStatusUpdate = React.useCallback(
    async (incidentId: string | null, status: AdminErrorStatus) => {
      if (!incidentId) return;
      await onUpdateErrorStatus(incidentId, status);
    },
    [onUpdateErrorStatus]
  );

  const handleResolveEventRow = React.useCallback(
    async (row: AdminErrorEventRow) => {
      if (row.incidentId && row.incidentStatus === "open") {
        await handleEventStatusUpdate(row.incidentId, "resolved");
        return;
      }
      if (row.incidentId === null) {
        await onUpdateErrorEventStatus(row.id, "resolved");
      }
    },
    [handleEventStatusUpdate, onUpdateErrorEventStatus]
  );

  const handleIgnoreEventRow = React.useCallback(
    async (row: AdminErrorEventRow) => {
      if (row.incidentId && row.incidentStatus === "open") {
        await handleEventStatusUpdate(row.incidentId, "ignored");
        return;
      }
      if (row.incidentId === null) {
        await onUpdateErrorEventStatus(row.id, "ignored");
      }
    },
    [handleEventStatusUpdate, onUpdateErrorEventStatus]
  );

  const resolveVisibleEvents = React.useCallback(async () => {
    if (resolveVisibleTargetCount === 0 || bulkResolveSubmitting) return;

    setBulkResolveSubmitting(true);
    setBulkResolveResult(null);
    try {
      for (const incidentId of resolvableVisibleIncidentIds) {
        await handleEventStatusUpdate(incidentId, "resolved");
      }
      for (const eventId of resolvableVisibleUnlinkedEventIds) {
        await onUpdateErrorEventStatus(eventId, "resolved");
      }

      const linkedResolvedCount = resolvableVisibleIncidentIds.length;
      const promotedResolvedCount = resolvableVisibleUnlinkedEventIds.length;
      setBulkResolveResult(
        `Resolved ${linkedResolvedCount} linked incident${linkedResolvedCount === 1 ? "" : "s"} and resolved ${promotedResolvedCount} unlinked event${promotedResolvedCount === 1 ? "" : "s"}.`
      );
    } finally {
      setBulkResolveSubmitting(false);
    }
  }, [
    bulkResolveSubmitting,
    handleEventStatusUpdate,
    onUpdateErrorEventStatus,
    resolvableVisibleIncidentIds,
    resolvableVisibleUnlinkedEventIds,
    resolveVisibleTargetCount,
  ]);

  const openSelectedEvent = React.useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId);
      void loadEventDetail(eventId);
    },
    [loadEventDetail]
  );

  const closeSelectedEvent = React.useCallback(() => {
    setSelectedEventId(null);
  }, []);

  React.useEffect(() => {
    const shouldAutoAdvance =
      !errorEventsLoading &&
      errorEventIncidentFilter !== "all" &&
      errorEvents.length > 0 &&
      visibleEvents.length === 0 &&
      errorEventsPagination.hasNextPage;

    if (!shouldAutoAdvance) {
      autoAdvancedEventPageRef.current = null;
      return;
    }
    if (autoAdvancedEventPageRef.current === errorEventsPagination.page) {
      return;
    }
    autoAdvancedEventPageRef.current = errorEventsPagination.page;
    onEventNextPage();
  }, [
    errorEventIncidentFilter,
    errorEvents.length,
    errorEventsLoading,
    errorEventsPagination.hasNextPage,
    errorEventsPagination.page,
    onEventNextPage,
    visibleEvents.length,
  ]);

  React.useEffect(() => {
    if (!selectedEventId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedEventId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedEventId]);

  return {
    copiedIncidentId,
    copiedEventId,
    selectedEventId,
    selectedEvent,
    selectedIncidentId,
    errorSourceOptions,
    visibleEvents,
    listedOpenIncidentCount,
    resolveVisibleTargetCount,
    bulkResolveSubmitting,
    bulkResolveResult,
    eventMetadataText,
    openSelectedEvent,
    closeSelectedEvent,
    handleCopyIncident,
    handleCopyEvent,
    handleResolveEventRow,
    handleIgnoreEventRow,
    resolveVisibleEvents,
  };
};
