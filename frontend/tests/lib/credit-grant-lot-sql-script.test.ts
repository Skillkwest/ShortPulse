/**
 * Guardrail tests for the credit grant-lot SQL migration and audit scripts.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const migrationPath = path.join(repoRoot, "sql/migrations/200_add_credit_grant_lot_expiration.sql");
const auditPath = path.join(repoRoot, "sql/audit_billing_credit_rls.sql");
const schedulerConfigurePath = path.join(
  repoRoot,
  "sql/configure_credit_expiration_scheduler_supabase.sql"
);
const schedulerHealthPath = path.join(repoRoot, "sql/check_control_plane_scheduler_health.sql");
const runtimeSecurityAuditPath = path.join(repoRoot, "sql/check_runtime_sql_security_audit.sql");
const controlPlaneEnforceGatePath = path.join(repoRoot, "sql/check_control_plane_enforce_gate.sql");
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/200_add_credit_grant_lot_expiration_rollback.sql"
);

describe("credit grant-lot SQL scripts", () => {
  it("requires source refs and validates replayed grant/debit ledger rows", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("raise exception 'Credit grants require source_ref'");
    expect(sql).toContain("raise exception 'Credit debits require source_ref'");
    expect(sql).toContain("Existing credit ledger source_ref does not match requested grant");
    expect(sql).toContain("Existing credit ledger source_ref does not match requested debit");
    expect(sql).toContain("metadata ->> 'credit_grant_lot'");
    expect(sql).toContain("metadata ->> 'credit_lot_debit'");
  });

  it("blocks legacy grant backfill when positive ledger value has no matching balance projection", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain("v_missing_balance_users");
    expect(sql).toContain("positive ai_credit_ledger value without ai_credit_balance rows");
    expect(sql).toContain("coalesce(sum(l.change_cents), 0) > 0");
  });

  it("keeps expired in-flight reservations visible without making them spendable", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");

    expect(sql).toContain(
      "coalesce(sum(g.remaining_cents) filter (\n            where g.expires_at is null or g.expires_at > now()\n        ), 0)::bigint as spendable_cents"
    );
    expect(sql).toContain("coalesce(sum(g.reserved_cents), 0)::bigint as reserved_cents");
    expect(sql).toContain("where g.user_id = p_user_id\n       and g.expired_at is null");
  });

  it("retires the pre-grant-lot aggregate reservation RPC", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const runtimeAuditSql = fs.readFileSync(runtimeSecurityAuditPath, "utf8");
    const enforceGateSql = fs.readFileSync(controlPlaneEnforceGatePath, "utf8");

    expect(migrationSql).toContain(
      "drop function if exists public.reserve_generation_credits(uuid, text, text, integer, text, jsonb)"
    );
    expect(runtimeAuditSql).toContain("retired_runtime_function_absent");
    expect(runtimeAuditSql).toContain("retired aggregate-balance reservation RPC must not exist");
    expect(runtimeAuditSql).not.toContain(
      "('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)', null)"
    );
    expect(enforceGateSql).toContain(
      "to_regprocedure('public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)') is null"
    );
  });

  it("audits missing balance/source-ref states after apply", () => {
    const sql = fs.readFileSync(auditPath, "utf8");

    expect(sql).toContain("'ai_credit_positive_ledger_missing_balance'");
    expect(sql).toContain("'ai_credit_grants_missing_source_ref'");
    expect(sql).toContain("'ai_credit_lot_ledger_missing_source_ref'");
  });

  it("guards destructive rollback after grant-lot rows exist", () => {
    const sql = fs.readFileSync(rollbackPath, "utf8");

    expect(sql).toContain("shortpulse.allow_credit_grant_lot_rollback");
    expect(sql).toContain("Refusing destructive grant-lot rollback");
    expect(sql).toContain("select count(*) from public.ai_credit_grants");
    expect(sql).toContain("select count(*) from public.ai_credit_grant_allocations");
  });

  it("requires the expiration scheduler URL to target the canonical worker route", () => {
    const sql = fs.readFileSync(schedulerConfigurePath, "utf8");

    expect(sql).toContain("must target /api/internal/credit-expirations/run");
    expect(sql).toContain("Credit expiration scheduler enqueued pg_net request_id=%");
  });

  it("surfaces pg_net HTTP response proof for the expiration scheduler", () => {
    const sql = fs.readFileSync(schedulerHealthPath, "utf8");

    expect(sql).toContain("Credit expiration scheduler HTTP response proof");
    expect(sql).toContain("shortpulse_credit_expirations_hourly");
    expect(sql).toContain("net._http_response");
    expect(sql).toContain("missing_pg_net_response");
    expect(sql).toContain("http_failure");
  });
});
