/**
 * Admin API: fetch raw app error events (every occurrence) for operator forensics.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  ACTIONABLE_PREFETCH_LIMIT,
  APP_ERROR_EVENTS_MISSING_REASON,
  DEFAULT_GENERATION_15M_THRESHOLD,
  DEFAULT_HIGH_15M_THRESHOLD,
  DEFAULT_LIMIT,
  DEFAULT_TOTAL_15M_THRESHOLD,
  MAX_LIMIT,
} from "../../../lib/server/api/adminErrorEvents/constants";
import {
  isActionableEvent,
  enrichEventsWithIncidentStatus,
} from "../../../lib/server/api/adminErrorEvents/enrichment";
import {
  asIncidentFilter,
  asPositiveInt,
  asSignalFilter,
  asSyntheticFilter,
  asThreshold,
  asFilterValue,
  normalizeSearchTerm,
} from "../../../lib/server/api/adminErrorEvents/parsing";
import {
  fetchErrorEventsDataset,
  fetchFallbackEventsPage,
} from "../../../lib/server/api/adminErrorEvents/queries";
import {
  buildAdmissionSummary,
  buildDegradedEventsPayload,
  countErrorMessage,
  countOrZero,
  healthyState,
  isMissingEventsTableError,
} from "../../../lib/server/api/adminErrorEvents/summary";
import type {
  EventFilterInput,
  IncidentFilterValue,
} from "../../../lib/server/api/adminErrorEvents/types";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const page = asPositiveInt(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
    const offset = (page - 1) * limit;

    const filters: EventFilterInput = {
      scope: asFilterValue(req.query.scope),
      severity: asFilterValue(req.query.severity),
      source: asFilterValue(req.query.source),
      search: normalizeSearchTerm(req.query.search),
      synthetic: asSyntheticFilter(req.query.synthetic),
      signal: asSignalFilter(req.query.signal),
      incident: asIncidentFilter(req.query.incident),
      excludeTelemetrySources: false,
    };
    const isActionableIncidentFilter = filters.incident === "actionable";
    const listFilters: EventFilterInput = isActionableIncidentFilter
      ? { ...filters, incident: "all" as IncidentFilterValue }
      : filters;

    const summaryFilters: EventFilterInput = {
      scope: "all",
      severity: "all",
      source: "all",
      search: "",
      // Operational summaries should reflect real traffic, not operator test events.
      synthetic: "exclude",
      signal: "all",
      incident: "all",
      excludeTelemetrySources: true,
    };

    const listRangeStart = isActionableIncidentFilter ? 0 : offset;
    const listRangeEnd = isActionableIncidentFilter
      ? ACTIONABLE_PREFETCH_LIMIT - 1
      : offset + limit - 1;

    const nowMs = Date.now();
    const since15mIso = new Date(nowMs - 15 * 60 * 1000).toISOString();
    const sinceHourIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const since24hIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const since15mMs = nowMs - 15 * 60 * 1000;
    const sinceHourMs = nowMs - 60 * 60 * 1000;
    const since24hMs = nowMs - 24 * 60 * 60 * 1000;

    const total15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M,
      DEFAULT_TOTAL_15M_THRESHOLD
    );
    const high15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M,
      DEFAULT_HIGH_15M_THRESHOLD
    );
    const generation15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M,
      DEFAULT_GENERATION_15M_THRESHOLD
    );

    const {
      eventsResult,
      filteredCountResult,
      last15mCountResult,
      high15mCountResult,
      generation15mCountResult,
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
    } = await fetchErrorEventsDataset({
      supabaseAdmin,
      listFilters,
      summaryFilters,
      listRangeStart,
      listRangeEnd,
      since15mIso,
      sinceHourIso,
      since24hIso,
    });

    if (eventsResult.error) {
      if (isMissingEventsTableError(eventsResult.error.message)) {
        return res.status(200).json(
          buildDegradedEventsPayload({
            perPage: limit,
            total15mThreshold,
            high15mThreshold,
            generation15mThreshold,
            reason: APP_ERROR_EVENTS_MISSING_REASON,
          })
        );
      }
      return res.status(500).json({
        error: eventsResult.error.message || "Unable to load error events.",
      });
    }

    let events = eventsResult.data ?? [];
    const eventRowsCount = Array.isArray(events) ? events.length : 0;
    const fallbackLikelyHasNextPage = eventRowsCount === limit;
    const hasFilteredCountError = isActionableIncidentFilter || Boolean(filteredCountResult.error);
    const totalCount = hasFilteredCountError
      ? offset + eventRowsCount + (fallbackLikelyHasNextPage ? 1 : 0)
      : Number(filteredCountResult.count ?? 0);
    const totalPages = hasFilteredCountError
      ? Math.max(1, page + (fallbackLikelyHasNextPage ? 1 : 0))
      : Math.max(1, Math.ceil(totalCount / limit));
    const resolvedPage = hasFilteredCountError
      ? page
      : totalCount > 0
        ? Math.min(page, totalPages)
        : 1;

    if (!hasFilteredCountError && resolvedPage !== page) {
      const fallbackOffset = (resolvedPage - 1) * limit;
      const fallbackResult = await fetchFallbackEventsPage({
        supabaseAdmin,
        filters,
        offset: fallbackOffset,
        limit,
      });
      if (fallbackResult.error) {
        return res.status(500).json({ error: fallbackResult.error.message });
      }
      events = fallbackResult.data ?? [];
    }

    const enrichedEventsResult = await enrichEventsWithIncidentStatus(supabaseAdmin, events);
    const summaryErrorMessages = [
      countErrorMessage(last15mCountResult),
      countErrorMessage(high15mCountResult),
      countErrorMessage(generation15mCountResult),
      countErrorMessage(lastHourCountResult),
      countErrorMessage(last24hCountResult),
      countErrorMessage(app24hCountResult),
      countErrorMessage(generation24hCountResult),
      countErrorMessage(high24hCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLastHourCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLast24hCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLastHourCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLast24hCountResult),
      admissionDeniedTelemetryRowsResult.error?.message ?? null,
    ].filter((value): value is string => Boolean(value));

    const admissionDeniedTelemetry = buildAdmissionSummary({
      rows: admissionDeniedTelemetryRowsResult.data,
      since15mMs,
      sinceHourMs,
      since24hMs,
    });

    const healthReasons: string[] = [];
    if (hasFilteredCountError) {
      healthReasons.push("Event pagination totals are estimated.");
    }
    if (summaryErrorMessages.length > 0) {
      healthReasons.push("Some event summary metrics are temporarily unavailable.");
    }
    if (enrichedEventsResult.degraded && enrichedEventsResult.reason) {
      healthReasons.push(enrichedEventsResult.reason);
    }

    let responseEvents = enrichedEventsResult.events;
    let responsePagination = {
      page: resolvedPage,
      perPage: limit,
      totalCount,
      totalPages,
      hasNextPage: hasFilteredCountError ? fallbackLikelyHasNextPage : resolvedPage < totalPages,
      hasPrevPage: resolvedPage > 1,
    };

    if (isActionableIncidentFilter) {
      const actionableEvents = responseEvents.filter(isActionableEvent);
      const actionableTotalCount = actionableEvents.length;
      const actionableTotalPages = Math.max(1, Math.ceil(actionableTotalCount / limit));
      const actionableResolvedPage =
        actionableTotalCount > 0 ? Math.min(page, actionableTotalPages) : 1;
      const actionableOffset = (actionableResolvedPage - 1) * limit;
      responseEvents = actionableEvents.slice(actionableOffset, actionableOffset + limit);
      responsePagination = {
        page: actionableResolvedPage,
        perPage: limit,
        totalCount: actionableTotalCount,
        totalPages: actionableTotalPages,
        hasNextPage: actionableResolvedPage < actionableTotalPages,
        hasPrevPage: actionableResolvedPage > 1,
      };
      healthReasons.push(
        "Actionable incident filtering uses bounded in-memory merge while relation OR parsing is unavailable."
      );
      if (eventRowsCount >= ACTIONABLE_PREFETCH_LIMIT) {
        healthReasons.push(
          "Actionable results may be truncated at prefetch limit; narrow filters for complete coverage."
        );
      }
    }

    const health = healthReasons.length
      ? {
          eventsTableAvailable: true,
          degraded: true,
          reason: healthReasons.join(" "),
        }
      : healthyState();

    return res.status(200).json({
      events: responseEvents,
      summary: {
        last15mCount: countOrZero(last15mCountResult),
        high15mCount: countOrZero(high15mCountResult),
        generation15mCount: countOrZero(generation15mCountResult),
        lastHourCount: countOrZero(lastHourCountResult),
        last24hCount: countOrZero(last24hCountResult),
        app24hCount: countOrZero(app24hCountResult),
        generation24hCount: countOrZero(generation24hCountResult),
        high24hCount: countOrZero(high24hCountResult),
        characterModeReferenceRefreshEmptyLastHourCount: countOrZero(
          characterModeReferenceRefreshEmptyLastHourCountResult
        ),
        characterModeReferenceRefreshEmptyLast24hCount: countOrZero(
          characterModeReferenceRefreshEmptyLast24hCountResult
        ),
        characterModeBundleUnavailableFallbackLastHourCount: countOrZero(
          characterModeBundleUnavailableFallbackLastHourCountResult
        ),
        characterModeBundleUnavailableFallbackLast24hCount: countOrZero(
          characterModeBundleUnavailableFallbackLast24hCountResult
        ),
        admissionDeniedTelemetry,
        total15mThreshold,
        high15mThreshold,
        generation15mThreshold,
        total15mBreached: countOrZero(last15mCountResult) >= total15mThreshold,
        high15mBreached: countOrZero(high15mCountResult) >= high15mThreshold,
        generation15mBreached: countOrZero(generation15mCountResult) >= generation15mThreshold,
      },
      health,
      pagination: responsePagination,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (isMissingEventsTableError(message)) {
      const total15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_TOTAL_15M,
        DEFAULT_TOTAL_15M_THRESHOLD
      );
      const high15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_HIGH_15M,
        DEFAULT_HIGH_15M_THRESHOLD
      );
      const generation15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_GENERATION_15M,
        DEFAULT_GENERATION_15M_THRESHOLD
      );
      const perPage = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
      return res.status(200).json(
        buildDegradedEventsPayload({
          perPage,
          total15mThreshold,
          high15mThreshold,
          generation15mThreshold,
          reason: APP_ERROR_EVENTS_MISSING_REASON,
        })
      );
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/error-events",
      user: adminUser,
      metadata: {
        scope_filter: typeof req.query.scope === "string" ? req.query.scope : null,
        severity_filter: typeof req.query.severity === "string" ? req.query.severity : null,
        source_filter: typeof req.query.source === "string" ? req.query.source : null,
        search_filter: typeof req.query.search === "string" ? req.query.search : null,
        synthetic_filter: typeof req.query.synthetic === "string" ? req.query.synthetic : null,
        signal_filter: typeof req.query.signal === "string" ? req.query.signal : null,
        incident_filter: typeof req.query.incident === "string" ? req.query.incident : null,
      },
    });

    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load error events.",
    });
  }
}
