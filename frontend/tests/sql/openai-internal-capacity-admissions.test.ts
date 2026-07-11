import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = fs.existsSync(path.resolve(process.cwd(), "sql/migrations"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const migrationPath = path.join(
  repoRoot,
  "sql/migrations/223_add_openai_internal_capacity_admissions.sql"
);
const sql = fs.readFileSync(migrationPath, "utf8");

describe("OpenAI internal-capacity admission migration", () => {
  it("creates a distinct durable authority with no customer-credit mutation", () => {
    expect(sql).toContain("create table if not exists public.openai_internal_capacity_admissions");
    expect(sql).toContain("eligibility_kind in ('paid', 'internal_comp')");
    expect(sql).toContain("from public.billing_subscription_contracts c");
    expect(sql).toContain("lower(coalesce(c.status, '')) in ('active', 'trialing', 'past_due')");
    expect(sql).toContain("Paid OpenAI internal-capacity access is required.");
    expect(sql).not.toContain("p_eligibility_kind");
    expect(sql).toContain("internal_budget_microusd bigint not null");
    expect(sql).toContain("unique (user_id, route_lane, idempotency_key)");
    expect(sql).not.toMatch(/update\s+public\.ai_credit|insert\s+into\s+public\.ai_credit/i);
  });

  it("keeps the table and all lifecycle RPCs service-role-only", () => {
    expect(sql).toContain(
      "revoke all on table public.openai_internal_capacity_admissions from public, anon, authenticated;"
    );
    expect(sql).toContain(
      "alter table public.openai_internal_capacity_admissions enable row level security;"
    );
    expect(sql.match(/security definer/g)).toHaveLength(3);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(3);
    expect(sql.match(/auth\.role\(\) is distinct from 'service_role'/g)).toHaveLength(3);
    for (const rpc of [
      "reserve_openai_internal_capacity_admission",
      "begin_openai_internal_capacity_attempt",
      "settle_openai_internal_capacity_admission",
    ]) {
      expect(sql).toContain(`create or replace function public.${rpc}`);
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?to service_role;`)
      );
    }
  });

  it("bounds expiry, retries, idempotency, and sanitized settlement usage", () => {
    expect(sql).toContain("p_ttl_seconds not between 30 and 3600");
    expect(sql).toContain("p_max_attempts not between 1 and 10");
    expect(sql).toContain("for update;");
    expect(sql).toContain("attempt_count = attempt_count + 1");
    expect(sql).toContain("OpenAI internal-capacity idempotency conflict.");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("c_user_active_limit constant integer := 4");
    expect(sql).toContain("c_global_active_limit constant integer := 100");
    expect(sql).toContain("OpenAI internal-capacity allowance is exhausted.");
    expect(sql).toContain("'estimated_cost_microusd'");
    expect(sql).toContain("jsonb_typeof(entry.value) not in ('number', 'null')");
  });
});
