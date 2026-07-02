/**
 * Admin API: fetch raw app error events (every occurrence) for operator forensics.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  APP_ERROR_EVENTS_MISSING_REASON,
  DEFAULT_GENERATION_15M_THRESHOLD,
  DEFAULT_HIGH_15M_THRESHOLD,
  DEFAULT_PROVIDER_RUNNING_TIMEOUT_15M_THRESHOLD,
  DEFAULT_LIMIT,
  DEFAULT_TOTAL_15M_THRESHOLD,
  MAX_LIMIT,
} from "../../../lib/server/api/adminErrorEvents/constants";
import { enrichEventsWithIncidentStatus } from "../../../lib/server/api/adminErrorEvents/enrichment";
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
  fetchErrorEventDetail,
  fetchFallbackEventsPage,
  fetchActionableErrorEvents,
} from "../../../lib/server/api/adminErrorEvents/queries";
import {
  createAdmissionSummary,
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

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/error-events.auth",
    });
    return res.status(500).json({ error: "Unable to load error events." });
  }
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId.trim() : "";
    if (eventId) {
      const detailResult = await fetchErrorEventDetail({
        supabaseAdmin,
        eventId,
      });

      if (detailResult.error) {
        if (isMissingEventsTableError(detailResult.error.message)) {
          return res.status(200).json({
            event: null,
            health: {
              eventsTableAvailable: false,
              degraded: true,
              reason: APP_ERROR_EVENTS_MISSING_REASON,
            },
          });
        }
        await logApiRouteException({
          req,
          error: detailResult.error,
          routeLabel: "admin/error-events.detail",
          user: adminUser,
          metadata: { event_id: eventId },
        });
        return res.status(500).json({
          error: detailResult.error.message || "Unable to load error event detail.",
        });
      }

      if (!detailResult.data) {
        return res.status(200).json({
          event: null,
          health: healthyState(),
        });
      }

      const enrichedDetailResult = await enrichEventsWithIncidentStatus(supabaseAdmin, [
        detailResult.data,
      ]);
      return res.status(200).json({
        event: enrichedDetailResult.events[0] ?? null,
        health: enrichedDetailResult.degraded
          ? {
              eventsTableAvailable: true,
              degraded: true,
              reason: enrichedDetailResult.reason,
            }
          : healthyState(),
      });
    }

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

    const listRangeStart = isActionableIncidentFilter ? 0 : offset;
    const listRangeEnd = isActionableIncidentFilter ? Math.max(0, limit - 1) : offset + limit - 1;

    const nowMs = Date.now();
    const since15mIso = new Date(nowMs - 15 * 60 * 1000).toISOString();
    const sinceHourIso = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const since24hIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

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
    const providerRunningTimeout15mThreshold = asThreshold(
      process.env.SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M,
      DEFAULT_PROVIDER_RUNNING_TIMEOUT_15M_THRESHOLD
    );

    const {
      eventsResult,
      filteredCountResult,
      filteredCountEstimated,
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
    } = await fetchErrorEventsDataset({
      supabaseAdmin,
      listFilters,
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
            providerRunningTimeout15mThreshold,
            reason: APP_ERROR_EVENTS_MISSING_REASON,
          })
        );
      }
      await logApiRouteException({
        req,
        error: eventsResult.error,
        routeLabel: "admin/error-events.list",
        user: adminUser,
      });
      return res.status(500).json({
        error: eventsResult.error.message || "Unable to load error events.",
      });
    }

    let events = isActionableIncidentFilter ? [] : (eventsResult.data ?? []);
    let eventRowsCount = Array.isArray(events) ? events.length : 0;
    let fallbackLikelyHasNextPage = eventRowsCount === limit;
    let hasFilteredCountError = Boolean(filteredCountResult.error);
    let paginationTotalsEstimated =
      isActionableIncidentFilter || filteredCountEstimated || hasFilteredCountError;
    let totalCount = paginationTotalsEstimated
      ? offset + eventRowsCount + (fallbackLikelyHasNextPage ? 1 : 0)
      : Number(filteredCountResult.count ?? 0);
    let totalPages = paginationTotalsEstimated
      ? Math.max(1, page + (fallbackLikelyHasNextPage ? 1 : 0))
      : Math.max(1, Math.ceil(totalCount / limit));
    let resolvedPage = paginationTotalsEstimated
      ? page
      : totalCount > 0
        ? Math.min(page, totalPages)
        : 1;

    if (isActionableIncidentFilter) {
      const actionableWindow = offset + limit;
      const actionableEventData = await fetchActionableErrorEvents({
        supabaseAdmin,
        filters,
        fetchWindow: actionableWindow,
      });

      if (actionableEventData.openEventsResult.error) {
        if (isMissingEventsTableError(actionableEventData.openEventsResult.error.message)) {
          return res.status(200).json(
            buildDegradedEventsPayload({
              perPage: limit,
              total15mThreshold,
              high15mThreshold,
              generation15mThreshold,
              providerRunningTimeout15mThreshold,
              reason: APP_ERROR_EVENTS_MISSING_REASON,
            })
          );
        }
        await logApiRouteException({
          req,
          error: actionableEventData.openEventsResult.error,
          routeLabel: "admin/error-events.actionable-open",
          user: adminUser,
        });
        return res.status(500).json({
          error:
            actionableEventData.openEventsResult.error.message || "Unable to load error events.",
        });
      }
      if (actionableEventData.unlinkedEventsResult.error) {
        if (isMissingEventsTableError(actionableEventData.unlinkedEventsResult.error.message)) {
          return res.status(200).json(
            buildDegradedEventsPayload({
              perPage: limit,
              total15mThreshold,
              high15mThreshold,
              generation15mThreshold,
              providerRunningTimeout15mThreshold,
              reason: APP_ERROR_EVENTS_MISSING_REASON,
            })
          );
        }
        await logApiRouteException({
          req,
          error: actionableEventData.unlinkedEventsResult.error,
          routeLabel: "admin/error-events.actionable-unlinked",
          user: adminUser,
        });
        return res.status(500).json({
          error:
            actionableEventData.unlinkedEventsResult.error.message ||
            "Unable to load error events.",
        });
      }

      const openEvents = Array.isArray(actionableEventData.openEventsResult.data)
        ? actionableEventData.openEventsResult.data
        : [];
      const unlinkedEvents = Array.isArray(actionableEventData.unlinkedEventsResult.data)
        ? actionableEventData.unlinkedEventsResult.data
        : [];
      const actionById = new Map<string, unknown>();
      type ActionableEventRow = {
        id: string;
        occurred_at?: string | null;
      };
      const mergedActionableEvents = [...openEvents, ...unlinkedEvents]
        .filter((row): row is ActionableEventRow => {
          return (
            row != null &&
            typeof row === "object" &&
            typeof (row as { id?: unknown }).id === "string"
          );
        })
        .sort((left, right) => {
          const leftTime = Date.parse(String(left.occurred_at ?? ""));
          const rightTime = Date.parse(String(right.occurred_at ?? ""));
          const leftMs = Number.isFinite(leftTime) ? leftTime : 0;
          const rightMs = Number.isFinite(rightTime) ? rightTime : 0;
          return rightMs - leftMs;
        })
        .filter((row) => {
          const eventId = String(row.id);
          if (actionById.has(eventId)) return false;
          actionById.set(eventId, row);
          return true;
        });

      const hasOpenCountError = Boolean(actionableEventData.openCountResult.error);
      const hasUnlinkedCountError = Boolean(actionableEventData.unlinkedCountResult.error);
      hasFilteredCountError = hasOpenCountError || hasUnlinkedCountError;
      paginationTotalsEstimated = actionableEventData.countsEstimated || hasFilteredCountError;
      eventRowsCount = mergedActionableEvents.length;
      fallbackLikelyHasNextPage =
        openEvents.length === actionableWindow || unlinkedEvents.length === actionableWindow;
      totalCount = paginationTotalsEstimated
        ? offset + eventRowsCount + (fallbackLikelyHasNextPage ? 1 : 0)
        : countOrZero(actionableEventData.openCountResult) +
          countOrZero(actionableEventData.unlinkedCountResult);
      totalPages = paginationTotalsEstimated
        ? Math.max(1, page + (fallbackLikelyHasNextPage ? 1 : 0))
        : Math.max(1, Math.ceil(totalCount / limit));
      resolvedPage =
        totalCount > 0 && !paginationTotalsEstimated ? Math.min(page, totalPages) : page;
      const responseOffset = (resolvedPage - 1) * limit;
      events = mergedActionableEvents.slice(responseOffset, responseOffset + limit);
    } else if (!paginationTotalsEstimated && resolvedPage !== page) {
      const fallbackOffset = (resolvedPage - 1) * limit;
      const fallbackResult = await fetchFallbackEventsPage({
        supabaseAdmin,
        filters,
        offset: fallbackOffset,
        limit,
      });
      if (fallbackResult.error) {
        await logApiRouteException({
          req,
          error: fallbackResult.error,
          routeLabel: "admin/error-events.list",
          user: adminUser,
        });
        return res.status(500).json({ error: fallbackResult.error.message });
      }
      events = fallbackResult.data ?? [];
    }

    const enrichedEventsResult = await enrichEventsWithIncidentStatus(supabaseAdmin, events);
    const summaryErrorMessages = [
      countErrorMessage(last15mCountResult),
      countErrorMessage(high15mCountResult),
      countErrorMessage(generation15mCountResult),
      countErrorMessage(providerRunningTimeout15mCountResult),
      countErrorMessage(lastHourCountResult),
      countErrorMessage(last24hCountResult),
      countErrorMessage(app24hCountResult),
      countErrorMessage(generation24hCountResult),
      countErrorMessage(high24hCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLastHourCountResult),
      countErrorMessage(characterModeReferenceRefreshEmptyLast24hCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLastHourCountResult),
      countErrorMessage(characterModeBundleUnavailableFallbackLast24hCountResult),
      countErrorMessage(projectWorkspaceRepairPendingLastHourCountResult),
      countErrorMessage(projectWorkspaceRepairPendingLast24hCountResult),
      admissionDeniedTelemetryResult.error?.message ?? null,
    ].filter((value): value is string => Boolean(value));

    const admissionDeniedTelemetry =
      admissionDeniedTelemetryResult.data ?? createAdmissionSummary();

    const healthReasons: string[] = [];
    if (hasFilteredCountError) {
      healthReasons.push("Event pagination totals are temporarily unavailable.");
    }
    if (summaryErrorMessages.length > 0) {
      healthReasons.push("Some event summary metrics are temporarily unavailable.");
    }
    if (enrichedEventsResult.degraded && enrichedEventsResult.reason) {
      healthReasons.push(enrichedEventsResult.reason);
    }

    const responseEvents = enrichedEventsResult.events;
    const responsePagination = {
      page: resolvedPage,
      perPage: limit,
      totalCount,
      totalPages,
      hasNextPage: paginationTotalsEstimated
        ? fallbackLikelyHasNextPage
        : resolvedPage < totalPages,
      hasPrevPage: resolvedPage > 1,
    };

    const health = healthReasons.length
      ? {
          eventsTableAvailable: true,
          degraded: true,
          reason: healthReasons.join(" "),
        }
      : healthyState();
    if (health.degraded) {
      await logApiRouteException({
        req,
        error: new Error("Admin error-events health degraded."),
        routeLabel: "admin/error-events.summary",
        user: adminUser,
        metadata: {
          filtered_count_error: filteredCountResult.error?.message ?? null,
          summary_errors: summaryErrorMessages,
          incident_enrichment_error: enrichedEventsResult.reason ?? null,
          actionable_incident_filter: isActionableIncidentFilter,
          pagination_totals_estimated: paginationTotalsEstimated,
        },
      });
    }

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
        providerRunningTimeout15mCount: countOrZero(providerRunningTimeout15mCountResult),
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
        projectWorkspaceRepairPendingLastHourCount: countOrZero(
          projectWorkspaceRepairPendingLastHourCountResult
        ),
        projectWorkspaceRepairPendingLast24hCount: countOrZero(
          projectWorkspaceRepairPendingLast24hCountResult
        ),
        admissionDeniedTelemetry,
        total15mThreshold,
        high15mThreshold,
        generation15mThreshold,
        providerRunningTimeout15mThreshold,
        total15mBreached: countOrZero(last15mCountResult) >= total15mThreshold,
        high15mBreached: countOrZero(high15mCountResult) >= high15mThreshold,
        generation15mBreached: countOrZero(generation15mCountResult) >= generation15mThreshold,
        providerRunningTimeout15mBreached:
          countOrZero(providerRunningTimeout15mCountResult) >= providerRunningTimeout15mThreshold,
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
      const providerRunningTimeout15mThreshold = asThreshold(
        process.env.SHORTPULSE_ADMIN_ALERT_PROVIDER_RUNNING_TIMEOUT_15M,
        DEFAULT_PROVIDER_RUNNING_TIMEOUT_15M_THRESHOLD
      );
      const perPage = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
      return res.status(200).json(
        buildDegradedEventsPayload({
          perPage,
          total15mThreshold,
          high15mThreshold,
          generation15mThreshold,
          providerRunningTimeout15mThreshold,
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
