import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const forwardMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/198_allow_equal_timestamp_project_workspace_updates.sql"
);
const rollbackMigrationPath = path.resolve(
  process.cwd(),
  "../sql/migrations/rollback/198_allow_equal_timestamp_project_workspace_updates_rollback.sql"
);
const schemaSnapshotPath = path.resolve(process.cwd(), "../docs/supabase_full_schema.sql");

describe("project workspace freshness guard migrations", () => {
  it("treats only older project workspace snapshots as stale", () => {
    const migrationSql = fs.readFileSync(forwardMigrationPath, "utf8");
    expect(migrationSql).toContain("and new.snapshot_updated_at < old.snapshot_updated_at");
    expect(migrationSql).not.toContain("and new.snapshot_updated_at <= old.snapshot_updated_at");
  });

  it("keeps the bootstrap schema aligned with the strict stale-write guard", () => {
    const schemaSql = fs.readFileSync(schemaSnapshotPath, "utf8");
    expect(schemaSql).toContain("and new.snapshot_updated_at < old.snapshot_updated_at");
    expect(schemaSql).not.toContain("and new.snapshot_updated_at <= old.snapshot_updated_at");
  });

  it("keeps rollback explicit about restoring the prior equality guard", () => {
    const rollbackSql = fs.readFileSync(rollbackMigrationPath, "utf8");
    expect(rollbackSql).toContain("and new.snapshot_updated_at <= old.snapshot_updated_at");
  });
});
