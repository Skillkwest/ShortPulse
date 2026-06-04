/**
 * Guardrail test for runtime SQL security audit script completeness.
 * Prevents accidental drift in expected RPC signatures and required checks.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const auditScriptPath = path.resolve(
  process.cwd(),
  "..",
  "sql",
  "check_runtime_sql_security_audit.sql"
);

const REQUIRED_SIGNATURES = [
  "public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text)",
  "public.create_admin_kanban_item(text,text,uuid,text)",
  "public.update_admin_kanban_item(uuid,text,text,uuid,text)",
  "public.move_admin_kanban_item(uuid,text,uuid,text)",
  "public.archive_admin_kanban_item(uuid,uuid,text)",
  "public.reserve_generation_credits(uuid,text,text,integer,text,jsonb)",
  "public.mark_generation_reservation_submitted(uuid,text,text,jsonb)",
  "public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)",
  "public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)",
  "public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)",
  "public.enqueue_generation_submit(uuid,text,text,text,text,text,integer,text,text,jsonb,integer,jsonb,text)",
  "public.claim_generation_submit_queue_batch(integer,integer,uuid)",
  "public.claim_generation_observation_inbox_batch(integer,integer)",
  "public.claim_generation_recovery_batch(integer,integer,integer,integer)",
  "public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)",
  "public.release_stale_generation_reservations(integer,integer)",
  "public.release_stale_provider_attached_generation_reservations(integer,integer,integer)",
  "public.resolve_media_storage_base_limit_bytes(uuid)",
  "public.resolve_media_storage_addon_limit_bytes(uuid)",
  "public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)",
  "public.prune_ai_agent_conversation_state_expired(integer)",
  "public.list_admin_user_health_active_targets(integer,integer)",
  "public.prune_admin_user_health_history(integer)",
] as const;

describe("check_runtime_sql_security_audit.sql", () => {
  it("tracks all critical runtime RPC signatures", () => {
    const sql = fs.readFileSync(auditScriptPath, "utf8");
    for (const signature of REQUIRED_SIGNATURES) {
      expect(sql).toContain(signature);
    }
  });

  it("includes all required grant/security checks and summary counters", () => {
    const sql = fs.readFileSync(auditScriptPath, "utf8");
    expect(sql).toContain("'exists'::text as check_name");
    expect(sql).toContain("'security_definer'::text as check_name");
    expect(sql).toContain("'execute_service_role'::text as check_name");
    expect(sql).toContain("'execute_public'::text as check_name");
    expect(sql).toContain("'execute_authenticated'::text as check_name");
    expect(sql).toContain("'execute_anon'::text as check_name");
    expect(sql).toContain("aclexplode(coalesce(p.proacl, acldefault('f', p.proowner)))");
    expect(sql).toContain("schema_checks(signature, check_name, check_pass, detail) as (");
    expect(sql).toContain("table_checks(signature, check_name, check_pass, detail) as (");
    expect(sql).toContain("sequence_checks(signature, check_name, check_pass, detail) as (");
    expect(sql).toContain("from all_checks\norder by signature, check_name;");
    expect(sql).toContain("count(*)::integer as total_checks");
    expect(sql).toContain("count(*) filter (where check_pass)::integer as passing_checks");
    expect(sql).toContain("count(*) filter (where not check_pass)::integer as failing_checks");
  });
});
