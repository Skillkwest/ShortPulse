import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");

function readRepoFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("admin Kanban backlog source contract", () => {
  it("keeps the local sync command wired to the planning backlog parser", () => {
    const packageJson = JSON.parse(readRepoFile("frontend/package.json"));
    const syncScript = readRepoFile("scripts/admin_kanban_backlog_sync.mjs");

    expect(packageJson.scripts["admin-kanban:sync-backlog"]).toBe(
      "cd .. && node scripts/admin_kanban_backlog_sync.mjs"
    );
    expect(syncScript).toContain("parsePlanningBacklogMarkdown");
    expect(syncScript).toContain("sync_admin_kanban_planning_backlog_items");
    expect(syncScript).toContain("p_dry_run: !apply");
  });

  it("documents source metadata and service-role sync in migration and schema snapshot", () => {
    const migration = readRepoFile("sql/migrations/222_add_admin_kanban_backlog_source_sync.sql");
    const schema = readRepoFile("docs/supabase_full_schema.sql");

    for (const source of [migration, schema]) {
      expect(source).toContain("source_type text not null default 'manual'");
      expect(source).toContain("source_type in ('manual', 'admin_error', 'planning_backlog')");
      expect(source).toContain(
        "create or replace function public.sync_admin_kanban_planning_backlog_items"
      );
      expect(source).toContain(
        "grant execute on function public.sync_admin_kanban_planning_backlog_items"
      );
      expect(source).toContain("action in ('created', 'updated', 'moved', 'archived', 'synced')");
    }
  });

  it("keeps Ophestivus intake from treating planning backlog cards as runnable tickets", () => {
    const intake = readRepoFile(
      "docs/records/artifacts/agent/ophestivus/tools/ophestivus_intake.mjs"
    );

    expect(intake).toContain('sourceType === "planning_backlog"');
    expect(intake).toContain('.neq("source_type", "planning_backlog")');
    expect(intake).toContain('p_source_type: "admin_error"');
  });
});
