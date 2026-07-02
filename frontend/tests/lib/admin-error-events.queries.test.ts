import { describe, expect, it } from "vitest";
import { fetchActionableErrorEvents } from "../../lib/server/api/adminErrorEvents/queries";
import type { EventQuery } from "../../lib/server/api/adminErrorEvents/types";

type QueryRecord = {
  table: string;
  operations: string[];
  selections: string[];
};

const createSupabaseAdminQueryRecorder = () => {
  const queries: QueryRecord[] = [];
  const supabaseAdmin = {
    from: (table: string) => {
      const record: QueryRecord = { table, operations: [], selections: [] };
      queries.push(record);

      const query = {
        select: (columns?: string) => {
          record.operations.push("select");
          if (columns) record.selections.push(columns);
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
    supabaseAdmin: supabaseAdmin as unknown as { from: (table: string) => EventQuery },
  };
};

describe("admin error-events query helpers", () => {
  it("excludes growth telemetry from actionable event queries", async () => {
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
    expect(appErrorEventQueries).toHaveLength(4);
    for (const query of appErrorEventQueries) {
      expect(query.operations).toContain("not:source:like:telemetry.marketing.%");
      expect(query.operations).toContain("not:source:like:telemetry.auth.%");
      expect(query.operations).toContain("not:source:like:telemetry.billing.%");
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
});
