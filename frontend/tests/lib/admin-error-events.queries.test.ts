import { describe, expect, it } from "vitest";
import {
  fetchActionableErrorEvents,
  fetchErrorEventsDataset,
} from "../../lib/server/api/adminErrorEvents/queries";
import type { EventQuery } from "../../lib/server/api/adminErrorEvents/types";

type QueryRecord = {
  table: string;
  operations: string[];
  selections: string[];
};

const createSupabaseAdminQueryRecorder = () => {
  const queries: QueryRecord[] = [];
  const supabaseAdmin = {
    rpc: () => Promise.resolve({ data: {}, error: null }),
    from: (table: string) => {
      const record: QueryRecord = { table, operations: [], selections: [] };
      queries.push(record);

      const query = {
        select: (columns?: string, options?: { count?: string; head?: boolean }) => {
          record.operations.push("select");
          if (columns) record.selections.push(columns);
          if (options?.count) record.operations.push(`count:${options.count}`);
          if (options?.head) record.operations.push("head");
          return query;
        },
        order: () => {
          record.operations.push("order");
          return query;
        },
        range: () => {
          record.operations.push("range");
          return query;
        },
        eq: (column: string, value: string) => {
          record.operations.push(`eq:${column}:${value}`);
          return query;
        },
        like: (column: string, value: string) => {
          record.operations.push(`like:${column}:${value}`);
          return query;
        },
        not: (column: string, operator: string, value: string) => {
          record.operations.push(`not:${column}:${operator}:${value}`);
          return query;
        },
        gte: (column: string, value: string) => {
          record.operations.push(`gte:${column}:${value}`);
          return query;
        },
        is: (column: string, value: null) => {
          record.operations.push(`is:${column}:${String(value)}`);
          return query;
        },
        or: (filters: string) => {
          record.operations.push(`or:${filters}`);
          return query;
        },
        then: (
          resolve: (value: { data: unknown[]; count: number; error: null }) => unknown,
          reject: (reason: unknown) => unknown
        ) => {
          return Promise.resolve({ data: [], count: 0, error: null }).then(resolve, reject);
        },
      };

      return query;
    },
  };

  return {
    queries,
    supabaseAdmin: supabaseAdmin as unknown as {
      from: (table: string) => EventQuery;
      rpc: (functionName: string) => Promise<{ data: unknown; error: null }>;
    },
  };
};

describe("admin error-events query helpers", () => {
  it("excludes routine non-actionable telemetry from actionable unlinked event queries", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    await fetchActionableErrorEvents({
      supabaseAdmin: supabaseAdmin as never,
      filters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "",
        synthetic: "exclude",
        signal: "all",
        incident: "actionable",
        excludeTelemetrySources: false,
      },
      fetchWindow: 50,
    });

    const appErrorEventQueries = queries.filter((query) => query.table === "app_error_events");
    expect(appErrorEventQueries).toHaveLength(2);
    const [openQuery, unlinkedQuery] = appErrorEventQueries;
    expect(openQuery?.operations).not.toContain("not:source:like:telemetry.ai_studio.stability.%");
    expect(unlinkedQuery?.operations).toContain("not:source:like:telemetry.marketing.%");
    expect(unlinkedQuery?.operations).toContain("not:source:like:telemetry.auth.%");
    expect(unlinkedQuery?.operations).toContain("not:source:like:telemetry.billing.%");
    expect(unlinkedQuery?.operations).toContain("not:source:like:telemetry.ai_studio.stability.%");
    for (const query of appErrorEventQueries) {
      expect(query.operations).not.toContain("count:exact");
      expect(query.operations).not.toContain("head");
    }
  });

  it("keeps actionable list projections off heavy event detail columns", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    await fetchActionableErrorEvents({
      supabaseAdmin: supabaseAdmin as never,
      filters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "",
        synthetic: "exclude",
        signal: "all",
        incident: "actionable",
        excludeTelemetrySources: false,
      },
      fetchWindow: 50,
    });

    const listSelections = queries
      .filter((query) => query.table === "app_error_events")
      .flatMap((query) => query.selections)
      .filter((selection) => selection.includes("occurred_at"));

    expect(listSelections.length).toBeGreaterThan(0);
    for (const selection of listSelections) {
      expect(selection).not.toContain("stack");
      expect(selection).not.toContain("metadata");
    }
  });

  it("keeps list pagination totals estimated without exact count queries", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    const result = await fetchErrorEventsDataset({
      supabaseAdmin: supabaseAdmin as never,
      listFilters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "",
        synthetic: "exclude",
        signal: "all",
        incident: "all",
        excludeTelemetrySources: false,
      },
      listRangeStart: 0,
      listRangeEnd: 49,
      since15mIso: "2026-07-02T00:00:00.000Z",
      sinceHourIso: "2026-07-01T23:00:00.000Z",
      since24hIso: "2026-07-01T00:00:00.000Z",
    });

    const appErrorEventQueries = queries.filter((query) => query.table === "app_error_events");
    expect(appErrorEventQueries).toHaveLength(1);
    expect(appErrorEventQueries[0]?.operations).not.toContain("count:exact");
    expect(appErrorEventQueries[0]?.operations).not.toContain("head");
    expect(result.filteredCountEstimated).toBe(true);
    expect(result.filteredCountResult).toEqual({ count: null, error: null });
  });

  it("excludes telemetry sources when the route asks for non-telemetry rows", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    await fetchErrorEventsDataset({
      supabaseAdmin: supabaseAdmin as never,
      listFilters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "",
        synthetic: "exclude",
        signal: "all",
        incident: "all",
        excludeTelemetrySources: true,
      },
      listRangeStart: 0,
      listRangeEnd: 49,
      since15mIso: "2026-07-02T00:00:00.000Z",
      sinceHourIso: "2026-07-01T23:00:00.000Z",
      since24hIso: "2026-07-01T00:00:00.000Z",
    });

    const listQuery = queries.find((query) => query.table === "app_error_events");
    expect(listQuery?.operations).toContain("not:source:like:telemetry.%");
  });

  it("keeps telemetry visible for explicit signal filters", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    await fetchErrorEventsDataset({
      supabaseAdmin: supabaseAdmin as never,
      listFilters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "",
        synthetic: "exclude",
        signal: "project_workspace_repair_pending",
        incident: "all",
        excludeTelemetrySources: false,
      },
      listRangeStart: 0,
      listRangeEnd: 49,
      since15mIso: "2026-07-02T00:00:00.000Z",
      sinceHourIso: "2026-07-01T23:00:00.000Z",
      since24hIso: "2026-07-01T00:00:00.000Z",
    });

    const listQuery = queries.find((query) => query.table === "app_error_events");
    expect(listQuery?.operations).not.toContain("not:source:like:telemetry.%");
    expect(listQuery?.operations).toContain(
      "eq:source:telemetry.ai_studio.project_workspace.repair_pending"
    );
  });

  it("keeps text search off uuid columns", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();

    await fetchErrorEventsDataset({
      supabaseAdmin: supabaseAdmin as never,
      listFilters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: "media-copy-from-url",
        synthetic: "exclude",
        signal: "all",
        incident: "all",
        excludeTelemetrySources: false,
      },
      listRangeStart: 0,
      listRangeEnd: 49,
      since15mIso: "2026-07-02T00:00:00.000Z",
      sinceHourIso: "2026-07-01T23:00:00.000Z",
      since24hIso: "2026-07-01T00:00:00.000Z",
    });

    const searchOperation = queries
      .find((query) => query.table === "app_error_events")
      ?.operations.find((operation) => operation.startsWith("or:"));

    expect(searchOperation).toContain("route.ilike.%media-copy-from-url%");
    expect(searchOperation).toContain("request_id.ilike.%media-copy-from-url%");
    expect(searchOperation).not.toContain("user_id.ilike");
    expect(searchOperation).not.toContain("incident_id.ilike");
    expect(searchOperation).not.toContain("or:id.ilike");
    expect(searchOperation).not.toContain(",id.ilike");
  });

  it("matches uuid search terms with exact uuid filters", async () => {
    const { queries, supabaseAdmin } = createSupabaseAdminQueryRecorder();
    const uuid = "11111111-1111-4111-8111-111111111111";

    await fetchErrorEventsDataset({
      supabaseAdmin: supabaseAdmin as never,
      listFilters: {
        scope: "all",
        severity: "all",
        source: "all",
        search: uuid,
        synthetic: "exclude",
        signal: "all",
        incident: "all",
        excludeTelemetrySources: false,
      },
      listRangeStart: 0,
      listRangeEnd: 49,
      since15mIso: "2026-07-02T00:00:00.000Z",
      sinceHourIso: "2026-07-01T23:00:00.000Z",
      since24hIso: "2026-07-01T00:00:00.000Z",
    });

    const searchOperation = queries
      .find((query) => query.table === "app_error_events")
      ?.operations.find((operation) => operation.startsWith("or:"));

    expect(searchOperation).toContain(`id.eq.${uuid}`);
    expect(searchOperation).toContain(`user_id.eq.${uuid}`);
    expect(searchOperation).toContain(`incident_id.eq.${uuid}`);
    expect(searchOperation).toContain(`request_id.eq.${uuid}`);
    expect(searchOperation).not.toContain("message.ilike");
    expect(searchOperation).not.toContain("route.ilike");
    expect(searchOperation).not.toContain("user_id.ilike");
    expect(searchOperation).not.toContain("incident_id.ilike");
  });
});
