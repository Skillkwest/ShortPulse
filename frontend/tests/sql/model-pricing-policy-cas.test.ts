/**
 * Static contract tests for the model-pricing apply compare-and-swap migration.
 */
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/227_add_model_pricing_policy_apply_cas.sql"
);
const rollbackPath = path.resolve(
  process.cwd(),
  "../sql/migrations/rollback/227_add_model_pricing_policy_apply_cas_rollback.sql"
);

describe("model-pricing policy apply CAS migration", () => {
  it("compares the expected active pointer while holding the canonical lock", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    const lockIndex = sql.indexOf("pg_advisory_xact_lock");
    const compareIndex = sql.indexOf(
      "v_runtime.active_policy_version_id is distinct from p_expected_active_policy_version_id"
    );
    const insertIndex = sql.indexOf("insert into public.model_pricing_policy_versions");

    expect(sql).toContain("p_expected_active_policy_version_id bigint");
    expect(lockIndex).toBeGreaterThan(0);
    expect(compareIndex).toBeGreaterThan(lockIndex);
    expect(insertIndex).toBeGreaterThan(compareIndex);
    expect(sql).toContain("to service_role");
  });

  it("keeps the old overload during rollout and rolls back only the CAS overload", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");
    const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

    expect(migrationSql).not.toContain(
      "drop function if exists public.apply_model_pricing_policy(jsonb, jsonb"
    );
    expect(rollbackSql).toContain("drop function if exists public.apply_model_pricing_policy");
    expect(rollbackSql).toContain("bigint");
  });
});
