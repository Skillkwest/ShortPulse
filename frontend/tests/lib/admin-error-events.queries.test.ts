import { describe, expect, it } from "vitest";
import { fetchActionableErrorEvents } from "../../lib/server/api/adminErrorEvents/queries";
import type { EventQuery } from "../../lib/server/api/adminErrorEvents/types";

type QueryRecord = {
  table: string;
  operations: string[];
};

const createSupabaseAdminQueryRecorder = () => {
  const queries: QueryRecord[] = [];
  const supabaseAdmin = {
    from: (table: string) => {
      const record: QueryRecord = { table, operations: [] };
      queries.push(record);

      const query = {
        select: () => {
          record.operations.push("select");
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
});
