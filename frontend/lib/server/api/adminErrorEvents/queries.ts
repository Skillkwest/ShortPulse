/**
 * Query orchestration helpers for admin error-events list + summary retrieval.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyEventFilters } from "./filters";
import { createAdmissionSummary } from "./summary";
import type {
  AdmissionSummary,
  CountQueryResult,
  EventFilterInput,
  EventQuery,
  ListQueryResult,
} from "./types";

const APP_ERROR_EVENTS_LIST_COLUMNS =
  "id, incident_id, fingerprint, source, scope, severity, message, route, endpoint, request_id, http_status, user_id, user_email, occurred_at, created_at, app_error_logs!left(status)";

const APP_ERROR_EVENTS_DETAIL_COLUMNS =
  "id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at, app_error_logs!left(status)";

export type ErrorEventsDatasetResult = {
  eventsResult: ListQueryResult;
  filteredCountResult: CountQueryResult;
  last15mCountResult: CountQueryResult;
  high15mCountResult: CountQueryResult;
  generation15mCountResult: CountQueryResult;
  providerRunningTimeout15mCountResult: CountQueryResult;
  lastHourCountResult: CountQueryResult;
  last24hCountResult: CountQueryResult;
  app24hCountResult: CountQueryResult;
  generation24hCountResult: CountQueryResult;
  high24hCountResult: CountQueryResult;
  characterModeReferenceRefreshEmptyLastHourCountResult: CountQueryResult;
  characterModeReferenceRefreshEmptyLast24hCountResult: CountQueryResult;
  characterModeBundleUnavailableFallbackLastHourCountResult: CountQueryResult;
  characterModeBundleUnavailableFallbackLast24hCountResult: CountQueryResult;
  projectWorkspaceRepairPendingLastHourCountResult: CountQueryResult;
  projectWorkspaceRepairPendingLast24hCountResult: CountQueryResult;
  admissionDeniedTelemetryResult: {
    data: AdmissionSummary | null;
    error: { message: string } | null;
  };
};

export type ErrorActionableEventsResult = {
  openEventsResult: ListQueryResult;
  unlinkedEventsResult: ListQueryResult;
  openCountResult: CountQueryResult;
  unlinkedCountResult: CountQueryResult;
};

type SummaryRpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type EventDetailQueryResult = {
  data: unknown | null;
  error: { message: string } | null;
};

type SummaryCountKey =
  | "last15mCount"
  | "high15mCount"
  | "generation15mCount"
  | "providerRunningTimeout15mCount"
  | "lastHourCount"
  | "last24hCount"
  | "app24hCount"
  | "generation24hCount"
  | "high24hCount"
  | "characterModeReferenceRefreshEmptyLastHourCount"
  | "characterModeReferenceRefreshEmptyLast24hCount"
  | "characterModeBundleUnavailableFallbackLastHourCount"
  | "characterModeBundleUnavailableFallbackLast24hCount"
  | "projectWorkspaceRepairPendingLastHourCount"
  | "projectWorkspaceRepairPendingLast24hCount";

const asSummaryRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const summaryCountResult = (result: SummaryRpcResult, key: SummaryCountKey): CountQueryResult => {
  if (result.error) return { count: null, error: result.error };
  const payload = asSummaryRecord(result.data);
  const rawValue = payload?.[key];
  const numericValue = typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
  return {
    count: Number.isFinite(numericValue) ? numericValue : 0,
    error: null,
  };
};

const summaryAdmissionResult = (
  result: SummaryRpcResult
): ErrorEventsDatasetResult["admissionDeniedTelemetryResult"] => {
  if (result.error) return { data: null, error: result.error };
  const payload = asSummaryRecord(result.data);
  const admissionSummary = payload?.admissionDeniedTelemetry;
  return {
    data: asSummaryRecord(admissionSummary)
      ? (admissionSummary as AdmissionSummary)
      : createAdmissionSummary(),
    error: null,
  };
};

export const fetchErrorEventsDataset = async (params: {
  supabaseAdmin: SupabaseClient;
  listFilters: EventFilterInput;
  listRangeStart: number;
  listRangeEnd: number;
  since15mIso: string;
  sinceHourIso: string;
  since24hIso: string;
}): Promise<ErrorEventsDatasetResult> => {
  const eventsQuery = applyEventFilters(
    params.supabaseAdmin
      .from("app_error_events")
      .select(APP_ERROR_EVENTS_LIST_COLUMNS)
      .order("occurred_at", { ascending: false })
      .range(params.listRangeStart, params.listRangeEnd) as unknown as EventQuery,
    params.listFilters
  ) as unknown as Promise<ListQueryResult>;

  const filteredCountQuery = applyEventFilters(
    params.supabaseAdmin.from("app_error_events").select("id, app_error_logs!left(status)", {
      count: "exact",
      head: true,
    }) as unknown as EventQuery,
    params.listFilters
  ) as unknown as Promise<CountQueryResult>;

  const [eventsResult, filteredCountResult, summaryResult] = await Promise.all([
    eventsQuery,
    filteredCountQuery,
    params.supabaseAdmin.rpc("get_admin_error_events_summary_v1", {
      p_since_15m: params.since15mIso,
      p_since_hour: params.sinceHourIso,
      p_since_24h: params.since24hIso,
    }) as unknown as Promise<SummaryRpcResult>,
  ]);

  const last15mCountResult = summaryCountResult(summaryResult, "last15mCount");
  const high15mCountResult = summaryCountResult(summaryResult, "high15mCount");
  const generation15mCountResult = summaryCountResult(summaryResult, "generation15mCount");
  const providerRunningTimeout15mCountResult = summaryCountResult(
    summaryResult,
    "providerRunningTimeout15mCount"
  );
  const lastHourCountResult = summaryCountResult(summaryResult, "lastHourCount");
  const last24hCountResult = summaryCountResult(summaryResult, "last24hCount");
  const app24hCountResult = summaryCountResult(summaryResult, "app24hCount");
  const generation24hCountResult = summaryCountResult(summaryResult, "generation24hCount");
  const high24hCountResult = summaryCountResult(summaryResult, "high24hCount");
  const characterModeReferenceRefreshEmptyLastHourCountResult = summaryCountResult(
    summaryResult,
    "characterModeReferenceRefreshEmptyLastHourCount"
  );
  const characterModeReferenceRefreshEmptyLast24hCountResult = summaryCountResult(
    summaryResult,
    "characterModeReferenceRefreshEmptyLast24hCount"
  );
  const characterModeBundleUnavailableFallbackLastHourCountResult = summaryCountResult(
    summaryResult,
    "characterModeBundleUnavailableFallbackLastHourCount"
  );
  const characterModeBundleUnavailableFallbackLast24hCountResult = summaryCountResult(
    summaryResult,
    "characterModeBundleUnavailableFallbackLast24hCount"
  );
  const projectWorkspaceRepairPendingLastHourCountResult = summaryCountResult(
    summaryResult,
    "projectWorkspaceRepairPendingLastHourCount"
  );
  const projectWorkspaceRepairPendingLast24hCountResult = summaryCountResult(
    summaryResult,
    "projectWorkspaceRepairPendingLast24hCount"
  );
  const admissionDeniedTelemetryResult = summaryAdmissionResult(summaryResult);

  return {
    eventsResult,
    filteredCountResult,
    last15mCountResult,
    high15mCountResult,
    generation15mCountResult,
    providerRunningTimeout15mCountResult,
    lastHourCountResult,
    last24hCountResult,
    app24hCountResult,
    generation24hCountResult,
    high24hCountResult,
    characterModeReferenceRefreshEmptyLastHourCountResult,
    characterModeReferenceRefreshEmptyLast24hCountResult,
    characterModeBundleUnavailableFallbackLastHourCountResult,
    characterModeBundleUnavailableFallbackLast24hCountResult,
    projectWorkspaceRepairPendingLastHourCountResult,
    projectWorkspaceRepairPendingLast24hCountResult,
    admissionDeniedTelemetryResult,
  };
};

export const fetchActionableErrorEvents = async (params: {
  supabaseAdmin: SupabaseClient;
  filters: EventFilterInput;
  fetchWindow: number;
}): Promise<ErrorActionableEventsResult> => {
  const window = Math.max(1, params.fetchWindow);
  const end = window - 1;
  const openFilters: EventFilterInput = {
    ...params.filters,
    incident: "open",
    excludeGrowthTelemetrySources: true,
  };
  const unlinkedFilters: EventFilterInput = {
    ...params.filters,
    incident: "unlinked",
    excludeGrowthTelemetrySources: true,
  };

  const [openEventsResult, unlinkedEventsResult, openCountResult, unlinkedCountResult] =
    await Promise.all([
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select(APP_ERROR_EVENTS_LIST_COLUMNS)
          .order("occurred_at", { ascending: false })
          .range(0, end) as unknown as EventQuery,
        openFilters
      ) as unknown as Promise<ListQueryResult>,
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select(APP_ERROR_EVENTS_LIST_COLUMNS)
          .order("occurred_at", { ascending: false })
          .range(0, end) as unknown as EventQuery,
        unlinkedFilters
      ) as unknown as Promise<ListQueryResult>,
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true }) as unknown as EventQuery,
        openFilters
      ) as unknown as Promise<CountQueryResult>,
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select("id", { count: "exact", head: true }) as unknown as EventQuery,
        unlinkedFilters
      ) as unknown as Promise<CountQueryResult>,
    ]);

  return {
    openEventsResult,
    unlinkedEventsResult,
    openCountResult,
    unlinkedCountResult,
  };
};

export const fetchFallbackEventsPage = async (params: {
  supabaseAdmin: SupabaseClient;
  filters: EventFilterInput;
  offset: number;
  limit: number;
}): Promise<ListQueryResult> => {
  return (await applyEventFilters(
    params.supabaseAdmin
      .from("app_error_events")
      .select(APP_ERROR_EVENTS_LIST_COLUMNS)
      .order("occurred_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1) as unknown as EventQuery,
    params.filters
  )) as unknown as ListQueryResult;
};

export const fetchErrorEventDetail = async (params: {
  supabaseAdmin: SupabaseClient;
  eventId: string;
}): Promise<EventDetailQueryResult> => {
  return (await params.supabaseAdmin
    .from("app_error_events")
    .select(APP_ERROR_EVENTS_DETAIL_COLUMNS)
    .eq("id", params.eventId)
    .maybeSingle()) as unknown as EventDetailQueryResult;
};
