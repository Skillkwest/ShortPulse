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
  "public.admin_update_app_error_status(uuid,uuid,text,text,uuid,text,boolean)",
  "public.create_admin_kanban_item(text,text,uuid,text)",
  "public.update_admin_kanban_item(uuid,text,text,uuid,text)",
  "public.move_admin_kanban_item(uuid,text,uuid,text)",
  "public.archive_admin_kanban_item(uuid,uuid,text)",
  "public.activate_billing_plan_offer(text,text,text,text,integer,integer,bigint,integer,text,text,boolean)",
  "public.activate_billing_storage_addon_offer(text,text,text,bigint,integer,text,text,boolean)",
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
  "public.get_media_folder_item_counts(uuid,uuid[])",
  "public.resolve_media_storage_object_by_basename(uuid,text)",
  "public.resolve_media_storage_usage_bytes(uuid)",
  "public.resolve_media_storage_base_limit_bytes(uuid)",
  "public.resolve_media_storage_addon_limit_bytes(uuid)",
  "public.upsert_ai_agent_conversation_state(uuid,text,text,interval,integer)",
  "public.prune_ai_agent_conversation_state_expired(integer)",
  "public.upsert_ai_studio_session_snapshot(uuid,uuid,jsonb,integer,text,interval,integer)",
  "public.get_ai_studio_session_snapshot(uuid,uuid)",
  "public.list_ai_studio_sessions(uuid,integer,timestamptz,uuid)",
  "public.prune_ai_studio_sessions_expired(integer)",
  "public.claim_media_derivative_batch(integer,integer,integer)",
  "public.mark_media_derivative_ready(uuid,uuid,text,integer,integer)",
  "public.mark_media_derivative_failed(uuid,uuid,text,integer,boolean)",
  "public.get_media_storage_lifecycle_summary(integer)",
  "public.list_admin_user_health_active_targets(integer,integer)",
  "public.prune_admin_user_health_history(integer)",
  "public.get_admin_global_stats_summary()",
  "public.list_admin_model_usage_stats(integer)",
  "public.get_admin_global_stats_v1()",
  "public.get_admin_generation_breakdown_v1()",
  "public.get_admin_growth_stats_v1()",
  "public.get_admin_first_value_funnel_v1()",
  "public.get_admin_error_events_summary_v1(timestamptz,timestamptz,timestamptz)",
  "public.publish_dashboard_announcement(text,text,uuid)",
  "public.reorder_dashboard_tutorials(uuid[],uuid)",
  "public.get_active_legal_policy(text)",
  "public.publish_legal_policy(text,text,timestamptz,text,uuid,text,text)",
  "public.get_active_agent_safety_policy()",
  "public.create_agent_safety_policy_version(text,jsonb,text,text,uuid,text,boolean,text)",
  "public.activate_agent_safety_policy(text,text,uuid,text,boolean,text)",
  "public.rollback_agent_safety_policy(text,uuid,text,text,integer)",
  "public.get_active_model_pricing_policy()",
  "public.apply_model_pricing_policy(jsonb,jsonb,text,text,uuid,text,text)",
  "public.rollback_model_pricing_policy(text,uuid,text,text)",
  "public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)",
  "public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)",
  "public.get_credit_grant_summary(uuid)",
  "public.get_credit_grant_summaries(uuid[])",
  "public.expire_credit_grants(integer)",
  "public.release_generation_reservation_by_id(uuid,text,jsonb)",
] as const;

const extractExpectedFunctionSignatureBlocks = (sql: string): string[][] =>
  Array.from(
    sql.matchAll(
      /with expected_functions as \([\s\S]*?\) as f\(signature, alternate_signature\)\s*\),/g
    )
  ).map((match) =>
    Array.from(match[0].matchAll(/\(\s*'([^']+)'/g)).map((signatureMatch) => signatureMatch[1])
  );

describe("check_runtime_sql_security_audit.sql", () => {
  it("tracks all critical runtime RPC signatures", () => {
    const sql = fs.readFileSync(auditScriptPath, "utf8");
    for (const signature of REQUIRED_SIGNATURES) {
      expect(sql).toContain(signature);
    }
  });

  it("keeps detailed and summary expected RPC lists in parity", () => {
    const sql = fs.readFileSync(auditScriptPath, "utf8");
    const blocks = extractExpectedFunctionSignatureBlocks(sql);
    expect(blocks).toHaveLength(2);

    const [detailSignatures, summarySignatures] = blocks.map((block) => [...new Set(block)].sort());
    expect(summarySignatures).toEqual(detailSignatures);
    expect(detailSignatures).toHaveLength(REQUIRED_SIGNATURES.length);

    for (const signature of REQUIRED_SIGNATURES) {
      expect(detailSignatures).toContain(signature);
      expect(summarySignatures).toContain(signature);
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

  it("requires PL/pgSQL ambiguity guards on grant-lot credit and reservation RPCs", () => {
    const sql = fs.readFileSync(auditScriptPath, "utf8");
    const guardedSignatures = [
      "public.grant_account_credits(uuid,integer,text,text,text,text,timestamptz,jsonb,uuid)",
      "public.debit_account_credits(uuid,integer,text,text,text,jsonb,uuid)",
      "public.get_credit_grant_summary(uuid)",
      "public.get_credit_grant_summaries(uuid[])",
      "public.expire_credit_grants(integer)",
      "public.admit_and_reserve_generation_credits(uuid,text,text,integer,text,jsonb,text,integer,text,integer,integer)",
      "public.release_generation_reservation_by_source_ref(uuid,text,text,jsonb)",
      "public.release_generation_reservation_by_provider_request(uuid,text,text,jsonb)",
      "public.release_generation_reservation_by_id(uuid,text,jsonb)",
      "public.capture_generation_reservation_by_provider_request(uuid,text,text,jsonb)",
    ];

    expect(sql).toContain("expected_variable_conflict_functions as (");
    expect(sql).toContain("'variable_conflict_use_column'::text as check_name");
    expect(sql).toContain(
      "grant-lot credit/reservation RPCs must prefer column names to avoid PL/pgSQL ambiguity"
    );
    for (const signature of guardedSignatures) {
      expect(sql).toContain(signature);
    }
  });
});
