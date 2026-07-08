import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const migrationPath = path.join(repoRoot, "sql/migrations/214_add_admin_error_watch_items.sql");
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/214_add_admin_error_watch_items_rollback.sql"
);

const readSql = (filePath: string) => fs.readFileSync(filePath, "utf8");

const extractPromotedIncidentInsert = (sql: string) => {
  const match = sql.match(
    /insert into public\.app_error_logs \(([\s\S]*?)\)\s*values \(([\s\S]*?)\)\s*returning id into v_incident_id;/
  );
  if (!match) {
    throw new Error("promoted app_error_logs insert block not found");
  }
  const columns = match[1]
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
  const values = match[2]
    .split(/,\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  return { columns, values };
};

describe("admin error watch item migration", () => {
  it("keeps watch items on the canonical status RPC and service-role-only signature", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain(
      "drop function if exists public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text);"
    );
    expect(sql).toContain("p_watch_item boolean default false");
    expect(sql).toContain("v_watch_item boolean := coalesce(p_watch_item, false);");
    expect(sql).toContain("if v_watch_item and v_next_status <> 'resolved' then");
    expect(sql).toContain("raise exception 'watch items must use resolved status.'");
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public");
    expect(sql).toContain("auth.role() <> 'service_role'");
    expect(sql).toContain(
      "revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean) from public;"
    );
    expect(sql).toContain(
      "revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean) from anon;"
    );
    expect(sql).toContain(
      "revoke all on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean) from authenticated;"
    );
    expect(sql).toContain(
      "grant execute on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean) to service_role;"
    );
  });

  it("preserves watch context in status history and clears stale current watch markers", () => {
    const sql = readSql(migrationPath);

    expect(sql.match(/'watch_item', case when v_watch_item then true else null end/g)).toHaveLength(
      2
    );
    for (const key of [
      "'watch_item'",
      "'watch_note'",
      "'watch_marked_at'",
      "'watch_marked_by'",
      "'watch_marked_by_email'",
    ]) {
      expect(sql).toContain(`- ${key}`);
    }
    expect(sql.match(/'watch_item', true/g)).toHaveLength(2);
    expect(sql.match(/'watch_note', v_note/g)).toHaveLength(2);
    expect(sql.match(/'watch_marked_at', v_now/g)).toHaveLength(2);
    expect(sql.match(/'watch_marked_by', p_admin_user_id/g)).toHaveLength(2);
    expect(sql.match(/'watch_marked_by_email', p_admin_user_email/g)).toHaveLength(2);
    expect(sql).toContain(
      "v_metadata := jsonb_set(v_metadata, '{status_history}', v_history, true);"
    );
  });

  it("keeps promoted-event incident insert columns aligned with values", () => {
    const sql = readSql(migrationPath);
    const { columns, values } = extractPromotedIncidentInsert(sql);
    const duplicateColumns = columns.filter((column, index) => columns.indexOf(column) !== index);

    expect(columns).toHaveLength(values.length);
    expect(duplicateColumns).toEqual([]);
    expect(columns).toContain("route");
    expect(columns).toContain("endpoint");
  });

  it("restores the previous six-argument RPC contract in rollback", () => {
    const sql = readSql(rollbackPath);

    expect(sql).toContain(
      "drop function if exists public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text, boolean);"
    );
    expect(sql).toContain("p_admin_user_email text default null");
    expect(sql).not.toContain("p_watch_item boolean");
    expect(sql).toContain(
      "grant execute on function public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text) to service_role;"
    );
  });
});
