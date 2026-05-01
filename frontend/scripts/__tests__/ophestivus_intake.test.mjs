/**
 * Ophestivus intake script tests.
 * Covers no-click Admin Errors handoff behavior without touching Supabase.
 */
import { describe, expect, it, vi } from "vitest";
import {
  readNextOpenIncident,
  removeIncidentsFromOpenErrors,
} from "../ophestivus_intake.mjs";

const makeIncidentRow = (overrides = {}) => ({
  id: "incident-1",
  fingerprint: "fingerprint-1",
  source: "api.admin.errors",
  scope: "admin",
  severity: "medium",
  status: "open",
  message: "Admin error",
  route: "/api/admin/errors",
  endpoint: null,
  first_seen_at: "2026-04-30T00:00:00.000Z",
  last_seen_at: "2026-04-30T00:00:00.000Z",
  occurrences_count: 1,
  ...overrides,
});

class FakeQuery {
  constructor(supabase, table) {
    this.supabase = supabase;
    this.table = table;
    this.filters = [];
    this.notFilters = [];
    this.orders = [];
  }

  select() {
    return this;
  }

  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }

  not(column, operator, value) {
    this.notFilters.push({ column, operator, value });
    return this;
  }

  order(column, options) {
    this.orders.push({ column, ascending: Boolean(options?.ascending) });
    return this;
  }

  limit(count) {
    this.supabase.queryLog.push({
      table: this.table,
      filters: this.filters,
      notFilters: this.notFilters,
      limit: count,
    });
    return Promise.resolve({ data: this.applyFilters().slice(0, count), error: null });
  }

  maybeSingle() {
    const [row] = this.applyFilters();
    return Promise.resolve({ data: row ?? null, error: null });
  }

  applyFilters() {
    let rows = [...(this.supabase.tables[this.table] ?? [])];
    for (const filter of this.filters) {
      rows = rows.filter((row) => row[filter.column] === filter.value);
    }
    for (const filter of this.notFilters) {
      if (filter.operator === "in") {
        const blockedValues = filter.value
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((value) => value.trim());
        rows = rows.filter((row) => !blockedValues.includes(row[filter.column]));
      }
    }
    return rows.sort((left, right) => {
      for (const order of this.orders) {
        const leftValue = left[order.column] ?? "";
        const rightValue = right[order.column] ?? "";
        if (leftValue === rightValue) continue;
        const result = leftValue > rightValue ? 1 : -1;
        return order.ascending ? result : -result;
      }
      return 0;
    });
  }
}

const createSupabase = (tables) => {
  const supabase = {
    tables,
    queryLog: [],
    rpc: vi.fn(async (_name, args) => {
      const row = tables.app_error_logs.find((incident) => incident.id === args.p_error_id);
      if (row) row.status = args.p_status;
      return { data: { ok: true }, error: null };
    }),
    from(table) {
      return new FakeQuery(this, table);
    },
  };
  return supabase;
};

describe("ophestivus intake script", () => {
  it("selects the next open incident by server-side severity priority", async () => {
    const supabase = createSupabase({
      app_error_logs: [
        makeIncidentRow({
          id: "medium-new",
          severity: "medium",
          last_seen_at: "2026-04-30T02:00:00.000Z",
        }),
        makeIncidentRow({
          id: "high-old",
          severity: "high",
          last_seen_at: "2026-04-30T01:00:00.000Z",
        }),
      ],
    });

    const incident = await readNextOpenIncident(supabase);

    expect(incident?.id).toBe("high-old");
    expect(supabase.queryLog[0]).toMatchObject({
      filters: [
        { column: "status", value: "open" },
        { column: "severity", value: "high" },
      ],
      limit: 1,
    });
  });

  it("removes all open same-fingerprint incidents during handoff", async () => {
    const supabase = createSupabase({
      app_error_logs: [
        makeIncidentRow({ id: "incident-main", fingerprint: "shared-fingerprint" }),
        makeIncidentRow({ id: "incident-duplicate", fingerprint: "shared-fingerprint" }),
        makeIncidentRow({ id: "incident-other", fingerprint: "other-fingerprint" }),
      ],
    });

    const result = await removeIncidentsFromOpenErrors(
      supabase,
      {
        id: "incident-main",
        fingerprint: "shared-fingerprint",
        status: "open",
      },
      { id: "ticket-1" },
      { id: "admin-1", email: "admin@example.com" }
    );

    expect(result.removedIncidentIds).toEqual(["incident-main", "incident-duplicate"]);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.tables.app_error_logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "incident-main", status: "ignored" }),
        expect.objectContaining({ id: "incident-duplicate", status: "ignored" }),
        expect.objectContaining({ id: "incident-other", status: "open" }),
      ])
    );
  });
});
