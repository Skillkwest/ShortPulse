import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const migrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/208_repair_model_pricing_policy_version_sequence.sql"
);
const rollbackPath = path.resolve(
  process.cwd(),
  "../sql/migrations/rollback/208_repair_model_pricing_policy_version_sequence_rollback.sql"
);
const diagnosticPath = path.resolve(process.cwd(), "../sql/check_model_pricing_control_plane.sql");

describe("model-pricing policy version sequence repair", () => {
  it("repairs the policy-version id sequence without inserting policy rows", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain(
      "pg_get_serial_sequence('public.model_pricing_policy_versions', 'id')"
    );
    expect(migrationSql).toContain("v_next_policy_id <= v_max_policy_id");
    expect(migrationSql).toContain(
      "perform setval(v_sequence_name::regclass, greatest(v_max_policy_id, 1), v_has_policy_versions);"
    );
    expect(migrationSql).not.toContain("insert into public.model_pricing_policy_versions");
    expect(migrationSql).not.toContain("delete from public.model_pricing_policy_versions");
  });

  it("documents that rollback must not rewind the sequence", () => {
    const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

    expect(rollbackSql).toContain("No automatic rollback is provided for migration 208");
    expect(rollbackSql).toContain(
      "Rewinding this sequence could recreate the production collision"
    );
  });

  it("reports sequence health in the read-only control-plane diagnostic", () => {
    const diagnosticSql = fs.readFileSync(diagnosticPath, "utf8");

    expect(diagnosticSql).toContain("policy_stats.max_policy_id");
    expect(diagnosticSql).toContain("policy_id_sequence.sequence_name");
    expect(diagnosticSql).toContain("policy_id_sequence.next_policy_id");
    expect(diagnosticSql).toContain("policy_id_sequence_ready");
    expect(diagnosticSql).toContain(
      "from public.model_pricing_policy_versions_id_seq sequence_state"
    );
  });
});
