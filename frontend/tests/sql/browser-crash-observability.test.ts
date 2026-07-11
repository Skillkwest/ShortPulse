import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..");
const migrationPath = path.join(
  repoRoot,
  "sql/migrations/220_harden_browser_crash_observability.sql"
);
const rollbackPath = path.join(
  repoRoot,
  "sql/migrations/rollback/220_harden_browser_crash_observability_rollback.sql"
);
const securityAuditPath = path.join(repoRoot, "sql/check_runtime_sql_security_audit.sql");
const calibrationPath = path.join(repoRoot, "sql/check_browser_crash_classifier_calibration.sql");
const serverPath = path.join(repoRoot, "frontend/lib/server/api/browserCrashSessions.ts");
const readSql = (filePath: string) => fs.readFileSync(filePath, "utf8");

const causalMediaCounterKeys = [
  "media_canvas_attached_video_source_count",
  "media_canvas_rendered_video_count",
  "media_duration_probe_cache_entry_count",
  "media_duration_probe_inflight_count",
  "media_duration_probe_queued_count",
  "media_grid_attached_video_source_count",
  "media_grid_autoplay_enabled_output_count",
  "media_grid_duplicate_video_output_count",
  "media_grid_tracked_video_node_count",
  "media_grid_visible_video_key_count",
] as const;

describe("browser crash observability migration", () => {
  it("keeps effective classification on one service-role-only list RPC", () => {
    const sql = readSql(migrationPath);
    const signature =
      "public.list_browser_crash_sessions_v2(integer, integer, text, text, text, timestamptz)";

    expect(sql).toContain("create or replace function public.list_browser_crash_sessions_v2(");
    expect(sql).toContain("security definer");
    expect(sql).toContain(`revoke all on function ${signature} from public;`);
    expect(sql).toContain(`revoke all on function ${signature} from anon;`);
    expect(sql).toContain(`revoke all on function ${signature} from authenticated;`);
    expect(sql).toContain(`grant execute on function ${signature} to service_role;`);
    expect(sql).toContain("or d.id::text = n.search_filter");
  });

  it("requires visible absolute-memory samples and excludes noisy pressure-only promotion", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("incoming_used >= 402653184");
    expect(sql).toContain("greatest(existing.max_used_js_heap_size, incoming_used) >= 536870912");
    expect(sql).toContain("incoming_metadata -> 'document_hidden' is distinct from 'true'::jsonb");
    expect(sql).toContain(
      "coalesce(incoming_metadata ->> 'visibility_state', 'visible') <> 'hidden'"
    );
    expect(sql).toContain("s.metadata -> 'document_hidden' is distinct from 'true'::jsonb");
    expect(sql).toContain("coalesce(s.metadata ->> 'visibility_state', 'visible') <> 'hidden'");
    expect(sql).not.toMatch(/pressure_level[^\n]*>=\s*2/);
    expect(sql).not.toMatch(/heap_used_to_total_ratio[^\n]*>=\s*0\.86/);
    const listClassifier = sql.slice(
      sql.indexOf("), classified as ("),
      sql.indexOf("), derived as (", sql.indexOf("), classified as ("))
    );
    expect(listClassifier).not.toContain("or s.visible_severe_stall_at is not null");
    expect(listClassifier).not.toContain("stale_after_visible_severe_stall");
  });

  it("reopens only on severity escalation and leaves explicit review updates intact", () => {
    const sql = readSql(migrationPath);
    const escalationBlock = sql.slice(
      sql.indexOf("if next_rank > old_rank"),
      sql.indexOf("next_suspected_at", sql.indexOf("if next_rank > old_rank"))
    );

    expect(escalationBlock).toContain("next_review_status := 'open'");
    expect(sql).toContain(
      "if existing.status = 'confirmed_crash' and p_event_type <> 'crash_report'"
    );
    expect(sql).toContain("c.reviewed_at < c.last_seen_at + interval '65 seconds'");
    expect(sql).toContain("d.effective_review_status = n.review_filter");
    expect(sql).toContain("jsonb_build_object('review_status', paged.effective_review_status)");
  });

  it("keeps clean-close terminal unless native crash evidence confirms the session", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("if existing.status = 'clean_closed' and p_event_type <> 'crash_report'");
    expect(sql).toContain("next_status not in ('confirmed_crash', 'clean_closed')");
  });

  it("keeps every crash report update-only, including service-routed authenticated input", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain(
      "if allow_insert and (p_user_id is null or p_event_type in ('previous_session_abandoned', 'crash_report'))"
    );
    const insertBlock = sql.slice(
      sql.indexOf("if existing.id is null then"),
      sql.indexOf("if existing.status = 'confirmed_crash'")
    );
    expect(insertBlock).not.toContain("when p_event_type = 'crash_report'");
  });

  it("uses database receipt ordering and atomically merges sanitized event metadata", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("receipt_at := clock_timestamp()");
    expect(sql).toContain("then existing.metadata else '{}'::jsonb end || incoming_metadata;");
    expect(sql).toContain("and next_status not in ('confirmed_crash', 'clean_closed')");
    expect(sql).toContain(
      "when next_status = 'confirmed_crash' and existing.status = 'confirmed_crash'"
    );
  });

  it("keeps every causal media counter inside both 48-key critical priority orders", () => {
    const sql = readSql(migrationPath);
    const server = readSql(serverPath);
    const sqlPriorityBlock = sql.slice(
      sql.indexOf("critical_metadata_keys constant text[]"),
      sql.indexOf("];", sql.indexOf("critical_metadata_keys constant text[]"))
    );
    const serverPriorityBlock = server.slice(
      server.indexOf("const CRITICAL_METADATA_KEY_ORDER"),
      server.indexOf("] as const", server.indexOf("const CRITICAL_METADATA_KEY_ORDER"))
    );

    for (const key of causalMediaCounterKeys) {
      expect(sqlPriorityBlock).toContain(`'${key}'`);
      expect(serverPriorityBlock).toContain(`"${key}"`);
    }
  });

  it("normalizes nullable insert authority and bounds metadata before first insert", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("allow_insert boolean := coalesce(p_allow_insert, false)");
    expect(sql).toContain("when jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) = 'object'");
    expect(sql).toContain("into incoming_metadata");
    expect(sql).toContain(
      "order by case when item.key = any(critical_metadata_keys) then 0 else 1 end, item.key"
    );
    expect(sql).toContain("to_jsonb(least(10000, previous_pressure_count + 1))");
    expect(sql).toContain("least(9223372036854775807::numeric");
  });

  it("calibrates stall-only evidence without treating one recovered stall as queue authority", () => {
    const sql = readSql(migrationPath);
    const calibration = readSql(calibrationPath);

    expect(sql).not.toContain("stale_after_visible_severe_stall");
    expect(calibration).toContain("stale_visible_stall_only_count");
    expect(calibration).toContain("clean_close_stall_evidence_count");
    expect(calibration).toContain("reviewed_stall_only_count");
    expect(calibration).toContain("group by grouping sets ((), (client_release, build_id))");
  });

  it("backfills typed evidence from privacy-safe legacy metadata", () => {
    const sql = readSql(migrationPath);

    expect(sql).toContain("with legacy_raw as (");
    expect(sql).toContain("metadata -> 'used_js_heap_size'");
    expect(sql).toContain("metadata -> 'heap_used_to_limit_ratio'");
    expect(sql).toContain("high_memory_sample_count = case");
    expect(sql).toContain("peer_abandoned_at = case");
  });

  it("provides rollback and security-audit coverage", () => {
    const rollback = readSql(rollbackPath);
    const securityAudit = readSql(securityAuditPath);

    expect(rollback).toContain("drop function if exists public.list_browser_crash_sessions_v2");
    expect(rollback).toContain(
      "drop function if exists public.record_browser_crash_session_event_v1"
    );
    expect(rollback).toContain("drop column if exists max_used_js_heap_size");
    expect(securityAudit.match(/public\.list_browser_crash_sessions_v2/g)).toHaveLength(4);
    expect(securityAudit.match(/public\.record_browser_crash_session_event_v1/g)).toHaveLength(4);
    expect(securityAudit.match(/fixed_empty_search_path/g)).toHaveLength(2);
    expect(securityAudit.match(/browser_crash_table_checks/g)).toHaveLength(4);
    expect(securityAudit.match(/browser crash evidence table must have RLS enabled/g)).toHaveLength(
      2
    );
    expect(securityAudit).toContain("public must not access browser crash evidence");
    expect(securityAudit).toContain("service_role must have SELECT, INSERT, UPDATE, and DELETE");
  });
});
