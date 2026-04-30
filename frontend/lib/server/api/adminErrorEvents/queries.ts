/**
 * Query orchestration helpers for admin error-events list + summary retrieval.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ADMISSION_LIMITED_TELEMETRY_SOURCE,
  CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT,
  CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT,
  CHARACTER_MODE_TELEMETRY_SOURCE,
} from "../errorTelemetryPolicy";
import { applyEventFilters } from "./filters";
import type { CountQueryResult, EventFilterInput, EventQuery, ListQueryResult } from "./types";

const APP_ERROR_EVENTS_COLUMNS =
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
  admissionDeniedTelemetryRowsResult: ListQueryResult;
};

export type ErrorActionableEventsResult = {
  openEventsResult: ListQueryResult;
  unlinkedEventsResult: ListQueryResult;
  openCountResult: CountQueryResult;
  unlinkedCountResult: CountQueryResult;
};

export const fetchErrorEventsDataset = async (params: {
  supabaseAdmin: SupabaseClient;
  listFilters: EventFilterInput;
  summaryFilters: EventFilterInput;
  listRangeStart: number;
  listRangeEnd: number;
  since15mIso: string;
  sinceHourIso: string;
  since24hIso: string;
}): Promise<ErrorEventsDatasetResult> => {
  const eventsQuery = applyEventFilters(
    params.supabaseAdmin
      .from("app_error_events")
      .select(APP_ERROR_EVENTS_COLUMNS)
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

  const [
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
    admissionDeniedTelemetryRowsResult,
  ] = await Promise.all([
    eventsQuery,
    filteredCountQuery,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since15mIso) as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since15mIso)
        .eq("severity", "high") as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since15mIso)
        .eq("scope", "generation") as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("ai_generations")
      .select("id", { count: "exact", head: true })
      .eq("status", "fail")
      .eq("failure_reason_code", "provider_running_timeout")
      .gte("completed_at", params.since15mIso) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.sinceHourIso) as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since24hIso) as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since24hIso)
        .eq("scope", "app") as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since24hIso)
        .eq("scope", "generation") as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    applyEventFilters(
      params.supabaseAdmin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("occurred_at", params.since24hIso)
        .eq("severity", "high") as unknown as EventQuery,
      params.summaryFilters
    ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("app_error_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", params.sinceHourIso)
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq(
        "message",
        CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT
      ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("app_error_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", params.since24hIso)
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq(
        "message",
        CHARACTER_MODE_REFERENCE_REFRESH_EMPTY_EVENT
      ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("app_error_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", params.sinceHourIso)
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq(
        "message",
        CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT
      ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("app_error_events")
      .select("id", { count: "exact", head: true })
      .gte("occurred_at", params.since24hIso)
      .eq("source", CHARACTER_MODE_TELEMETRY_SOURCE)
      .eq(
        "message",
        CHARACTER_MODE_BUNDLE_UNAVAILABLE_FALLBACK_EVENT
      ) as unknown as Promise<CountQueryResult>,
    params.supabaseAdmin
      .from("app_error_events")
      .select("occurred_at, metadata")
      .eq("source", ADMISSION_LIMITED_TELEMETRY_SOURCE)
      .gte("occurred_at", params.since24hIso) as unknown as Promise<ListQueryResult>,
  ]);

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
    admissionDeniedTelemetryRowsResult,
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
  };
  const unlinkedFilters: EventFilterInput = {
    ...params.filters,
    incident: "unlinked",
  };

  const [openEventsResult, unlinkedEventsResult, openCountResult, unlinkedCountResult] =
    await Promise.all([
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select(APP_ERROR_EVENTS_COLUMNS)
          .order("occurred_at", { ascending: false })
          .range(0, end) as unknown as EventQuery,
        openFilters
      ) as unknown as Promise<ListQueryResult>,
      applyEventFilters(
        params.supabaseAdmin
          .from("app_error_events")
          .select(APP_ERROR_EVENTS_COLUMNS)
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
      .select(APP_ERROR_EVENTS_COLUMNS)
      .order("occurred_at", { ascending: false })
      .range(params.offset, params.offset + params.limit - 1) as unknown as EventQuery,
    params.filters
  )) as unknown as ListQueryResult;
};
