import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const migrationPath = path.join(
  repoRoot,
  "sql/migrations/219_add_account_storage_ownership_proof.sql"
);
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/219_add_account_storage_ownership_proof_rollback.sql"
);
const reportSqlPath = path.join(repoRoot, "sql/check_account_storage_ownership_proof.sql");

const read = (filePath: string) => fs.readFileSync(filePath, "utf8");

describe("account storage ownership proof SQL", () => {
  it("adds service-role-only proof RPCs without deletion authority", () => {
    const sql = read(migrationPath);

    expect(sql).toContain(
      "create or replace function public.get_account_storage_ownership_proof_details"
    );
    expect(sql).toContain(
      "create or replace function public.get_account_storage_ownership_proof_summary"
    );
    expect(sql.match(/security definer/g)).toHaveLength(2);
    expect(sql).toContain("set search_path = public, storage, auth, pg_temp");

    for (const signature of [
      "public.get_account_storage_ownership_proof_details(integer, uuid, integer)",
      "public.get_account_storage_ownership_proof_summary(integer)",
    ]) {
      expect(sql).toContain(`revoke all on function ${signature} from public;`);
      expect(sql).toContain(`revoke all on function ${signature} from anon;`);
      expect(sql).toContain(`revoke all on function ${signature} from authenticated;`);
      expect(sql).toContain(`grant execute on function ${signature} to service_role;`);
    }

    expect(sql).not.toMatch(/\bdelete\s+from\b/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/\bstorage\.delete\b/i);
    expect(sql).not.toMatch(/\bstorage\.remove\b/i);
    expect(sql).not.toContain("storage.objects delete");
  });

  it("uses the canonical proof signals and keeps active users report-only", () => {
    const sql = read(migrationPath);

    for (const source of [
      "auth.users",
      "storage.objects",
      "public.ai_generations",
      "public.ai_credit_ledger",
      "public.ai_credit_reservations",
      "public.media_files",
      "public.projects",
      "public.project_workspace_states",
      "public.user_owned_custom_voices",
      "public.voice_source_lifecycle",
      "public.billing_subscription_contracts",
    ]) {
      expect(sql).toContain(source);
    }

    expect(sql).toContain("when c.open_or_grace_contract_count > 0 then 'active_user_report_only'");
    expect(sql).toContain(
      "when c.active_credit_reservation_count > 0 then 'active_user_report_only'"
    );
    expect(sql).toContain(
      "when c.activity_status = 'recent_activity' then 'active_user_report_only'"
    );
    expect(sql).toContain("else 'inactive_user_report_only'");
    expect(sql).toContain("Storage prefix has no matching auth.users row");
    expect(sql).toContain("not deletion authority");
  });

  it("keeps the default report aggregate-only", () => {
    const reportSql = read(reportSqlPath);

    expect(reportSql).toContain("get_account_storage_ownership_proof_summary");
    expect(reportSql).not.toContain("get_account_storage_ownership_proof_details");
    expect(reportSql).not.toContain("user_id");
    expect(reportSql).not.toContain("user_email");
    expect(reportSql).not.toContain("storage_path");
    expect(reportSql).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("has a narrow rollback for the proof RPCs only", () => {
    const rollbackSql = read(rollbackPath);

    expect(rollbackSql).toContain(
      "drop function if exists public.get_account_storage_ownership_proof_summary(integer);"
    );
    expect(rollbackSql).toContain(
      "drop function if exists public.get_account_storage_ownership_proof_details(integer, uuid, integer);"
    );
    expect(rollbackSql).not.toContain("drop table");
    expect(rollbackSql).not.toMatch(/\bdelete\s+from\b/i);
  });
});
