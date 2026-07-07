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

describe("model-pricing control-plane sequence repair", () => {
  it("repairs policy-version and event id sequences without inserting rows", () => {
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    expect(migrationSql).toContain("public.model_pricing_policy_versions");
    expect(migrationSql).toContain("public.model_pricing_policy_events");
    expect(migrationSql).toContain(
      "pg_get_serial_sequence(v_target.table_name, v_target.column_name)"
    );
    expect(migrationSql).toContain("v_next_id <= v_max_id");
    expect(migrationSql).toContain("perform setval(v_sequence_name::regclass");
    expect(migrationSql).not.toContain("insert into public.model_pricing_policy_versions");
    expect(migrationSql).not.toContain("insert into public.model_pricing_policy_events");
    expect(migrationSql).not.toContain("delete from public.model_pricing_policy_versions");
    expect(migrationSql).not.toContain("delete from public.model_pricing_policy_events");
  });

  it("documents that rollback must not rewind the sequence", () => {
    const rollbackSql = fs.readFileSync(rollbackPath, "utf8");

    expect(rollbackSql).toContain("No automatic rollback is provided for migration 208");
    expect(rollbackSql).toContain(
      "Rewinding these sequences could recreate the production collision"
    );
  });

  it("reports sequence health for policy versions and events in the read-only diagnostic", () => {
    const diagnosticSql = fs.readFileSync(diagnosticPath, "utf8");

    expect(diagnosticSql).toContain("policy_stats.max_policy_id");
    expect(diagnosticSql).toContain("policy_id_sequence.sequence_name");
    expect(diagnosticSql).toContain("policy_id_sequence.next_policy_id");
    expect(diagnosticSql).toContain("policy_id_sequence_ready");
    expect(diagnosticSql).toContain("policy_event_stats.max_policy_event_id");
    expect(diagnosticSql).toContain("policy_event_sequence.sequence_name");
    expect(diagnosticSql).toContain("policy_event_sequence.next_policy_event_id");
    expect(diagnosticSql).toContain("policy_event_sequence_ready");
    expect(diagnosticSql).toContain(
      "from public.model_pricing_policy_versions_id_seq sequence_state"
    );
    expect(diagnosticSql).toContain(
      "from public.model_pricing_policy_events_id_seq sequence_state"
    );
  });
});
