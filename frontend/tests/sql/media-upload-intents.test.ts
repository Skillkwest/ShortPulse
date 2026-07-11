import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = fs.existsSync(path.resolve(process.cwd(), "sql/migrations"))
  ? process.cwd()
  : path.resolve(process.cwd(), "..");
const migrationPath = path.join(repoRoot, "sql/migrations/225_add_media_upload_intents.sql");
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/225_add_media_upload_intents_rollback.sql"
);
const stagingMimeReconcilePath = path.join(
  repoRoot,
  "sql/migrations/226_reconcile_media_upload_staging_mime_allowlist.sql"
);
const stagingMimeReconcileRollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/226_reconcile_media_upload_staging_mime_allowlist_rollback.sql"
);
const bootstrapSchemaPath = path.join(repoRoot, "docs/supabase_full_schema.sql");
const sql = fs.readFileSync(migrationPath, "utf8");
const rollbackSql = fs.readFileSync(rollbackPath, "utf8");
const stagingMimeReconcileSql = fs.readFileSync(stagingMimeReconcilePath, "utf8");
const stagingMimeReconcileRollbackSql = fs.readFileSync(stagingMimeReconcileRollbackPath, "utf8");
const bootstrapSchemaSql = fs.readFileSync(bootstrapSchemaPath, "utf8");

describe("media upload intent migration", () => {
  it("creates a private bounded staging bucket and distinct transport authority", () => {
    expect(sql.trimStart()).toMatch(/^--[\s\S]*?begin;/);
    expect(sql.trimEnd()).toMatch(/commit;$/);
    expect(sql).toContain("'media_upload_staging'");
    expect(sql).toContain("104857600");
    for (const mimeType of ["image/heic", "image/heif", "image/avif", "video/x-m4v"]) {
      expect(sql).toContain(`'${mimeType}'`);
    }
    expect(sql).toContain("create table if not exists public.media_upload_intents");
    expect(sql).toContain("unique (user_id, purpose, idempotency_key)");
    expect(sql).toContain("constraint media_upload_intents_purpose_kind_check");
    expect(sql).toContain("constraint media_upload_intents_mime_kind_check");
    expect(sql).toContain("declared_mime_type like media_kind || '/%'");
    expect(sql).toContain("v_staging_path := p_user_id::text || '/' || v_id::text || '/object'");
    expect(sql).not.toMatch(/ai_credit|provider_staging|billing_subscription/i);
    expect(sql).not.toMatch(/signed[_ ]url|upload[_ ]token/i);
  });

  it("keeps the table and lifecycle RPCs service-role-only with no browser policy", () => {
    expect(sql).toContain("alter table public.media_upload_intents enable row level security;");
    expect(sql).toContain(
      "revoke all on table public.media_upload_intents from public, anon, authenticated;"
    );
    expect(sql).not.toMatch(/create\s+policy/i);
    expect(sql.match(/security definer/g)).toHaveLength(5);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(5);
    expect(sql.match(/auth\.role\(\) is distinct from 'service_role'/g)).toHaveLength(5);
    for (const rpc of [
      "reserve_media_upload_intent",
      "claim_media_upload_intent",
      "finalize_media_upload_intent",
      "reject_media_upload_intent",
      "expire_media_upload_intent",
    ]) {
      expect(sql).toContain(`create or replace function public.${rpc}`);
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${rpc}\\([\\s\\S]*?to service_role;`)
      );
    }
  });

  it("bounds transport lifetime, bytes, lifecycle, and sanitized inspection facts", () => {
    expect(sql).toContain("p_ttl_seconds not between 300 and 7200");
    expect(sql).toContain("p_ttl_seconds integer default 7200");
    expect(sql).toContain("p_max_bytes not between 1 and 104857600");
    expect(sql).toContain("status in ('prepared', 'claimed', 'finalized', 'rejected', 'expired')");
    expect(sql).toContain("for update;");
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended(");
    expect(sql).toContain("p_user_id::text || ':' || p_purpose || ':' || p_idempotency_key");
    expect(sql).toContain("if v_row.status <> 'prepared'");
    expect(sql).toContain("Media upload intent is not claimable.");
    expect(sql.match(/and staging_path = p_staging_path/g)).toHaveLength(3);
    expect(sql).toContain("inspection_result = 'accepted'");
    expect(sql).toContain("Media upload intent byte limit exceeded.");
    expect(sql).not.toContain("jsonb");
  });

  it("provides a rollback that retains a non-empty staging bucket", () => {
    expect(rollbackSql.trimStart()).toMatch(/^begin;/);
    expect(rollbackSql.trimEnd()).toMatch(/commit;$/);
    expect(rollbackSql).toContain("drop table if exists public.media_upload_intents;");
    expect(rollbackSql).toContain("delete from storage.buckets b");
    expect(rollbackSql).toContain("not exists");
    expect(rollbackSql).toContain("from storage.objects o where o.bucket_id = b.id");
  });

  it("keeps the canonical bootstrap schema aligned with the transport authority", () => {
    expect(bootstrapSchemaSql).toContain("create table if not exists public.media_upload_intents");
    expect(bootstrapSchemaSql).toContain("'media_upload_staging'");
    expect(bootstrapSchemaSql).toContain(
      "revoke all on table public.media_upload_intents from public, anon, authenticated;"
    );
    for (const rpc of [
      "reserve_media_upload_intent",
      "claim_media_upload_intent",
      "finalize_media_upload_intent",
      "reject_media_upload_intent",
      "expire_media_upload_intent",
    ]) {
      expect(bootstrapSchemaSql).toContain(`create or replace function public.${rpc}`);
    }
  });

  it("reconciles the staging bucket MIME allowlist with the runtime audit", () => {
    expect(stagingMimeReconcileSql.trimStart()).toMatch(/^--[\s\S]*?begin;/);
    expect(stagingMimeReconcileSql.trimEnd()).toMatch(/commit;$/);
    expect(stagingMimeReconcileSql).toContain("'media_upload_staging'");
    expect(stagingMimeReconcileSql).toContain("'audio/m4a'");
    expect(stagingMimeReconcileSql).toContain("'audio/x-m4a'");
    expect(stagingMimeReconcileSql).toContain("file_size_limit = excluded.file_size_limit");
    expect(stagingMimeReconcileSql).not.toMatch(/create\s+policy/i);
    expect(stagingMimeReconcileSql).not.toContain("media_upload_intents");

    expect(stagingMimeReconcileRollbackSql.trimStart()).toMatch(/^begin;/);
    expect(stagingMimeReconcileRollbackSql.trimEnd()).toMatch(/commit;$/);
    expect(stagingMimeReconcileRollbackSql).not.toContain("'audio/m4a'");
    expect(stagingMimeReconcileRollbackSql).toContain("'audio/x-m4a'");
  });
});
