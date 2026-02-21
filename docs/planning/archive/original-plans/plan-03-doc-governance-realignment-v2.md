# ShortPulse Documentation + Governance Realignment v2 (with 018 Addendum)

## Summary
This revision incorporates additional audit findings from 018_add_ai_agent_conversation_state.sql and newer best-practice anchors for docs governance, SQL security, CI enforcement, and changelog hygiene.  
Execution remains phased PRs with hard CI gates.

## New Audit Findings Added (018-specific)
1. SECURITY DEFINER hardening is incomplete relative to PostgreSQL guidance.
2. Function grants still include authenticated, expanding callable surface beyond required server-side usage.
3. Caller-controlled p_ttl and p_user_cap are not upper-bounded, weakening bounded-retention guarantees.
4. conversation_id is unbounded text with no max length guard, creating index/storage abuse risk.
5. Overflow eviction is not deterministic enough under timestamp ties; retention can remove unintended rows.
6. Expired-row cleanup is write-triggered only; inactive-user rows can linger indefinitely.
7. No global default-privilege guard exists to prevent future functions from being executable by PUBLIC.
8. SQL quality gates do not include database linting (supabase db lint) in CI.

## Program Scope
In scope:
- All authoritative docs and instruction layers.
- 018 security posture via forward migration hardening.
- Docs semantic drift automation and branch protections.
- Changelog normalization and archival policy consistency.

Out of scope:
- Unrelated feature work.
- Rewriting historical migrations in-place (forward migrations only).

## Implementation Phases

## Phase 0: Governance Contract Lock
Files:
- documentation_overview.md
- README.md
- agent-playbook.md

Actions:
1. Add explicit authority tiers: authoritative, operational helper, working, historical.
2. Add required metadata for authoritative docs: Owner, Last Reviewed, Authority, Doc Type.
3. Adopt Diátaxis doc typing tags for authoritative docs.
4. Define one canonical “truth chain” list for routes/auth/schema/API docs.

Acceptance:
- No conflicting “source of truth” claims across root governance docs.

## Phase 1: Migration 018 Security Hardening (forward migration)
Files:
- 028_harden_ai_agent_conversation_state_security.sql
- 028_harden_ai_agent_conversation_state_security_rollback.sql
- agentConversationState.ts

Actions:
1. Restrict execute grant of upsert_ai_agent_conversation_state to service_role only.
2. Keep SECURITY DEFINER with secure search_path convention and trusted-schema ordering.
3. Clamp TTL server-side to 1 day..90 days; keep default 30 days.
4. Clamp per-user cap server-side to 1..200.
5. Add conversation_id max length constraint at DB/function guard (default: 191 chars).
6. Make retention eviction deterministic with stable ordering including a tie-breaker.
7. Ensure current conversation row is never evicted in same upsert cycle.
8. Add operational cleanup function/procedure for stale rows and schedule guidance (daily).

Acceptance:
- Authenticated direct RPC calls fail; service-role path succeeds.
- TTL/cap abuse attempts are clamped.
- Deterministic retention behavior is verifiable by test.

## Phase 2: Schema Truth-Chain Alignment
Files:
- database-migrations.md
- sop_sql_migration_operations.md
- data-dictionary.md
- supabase_full_schema.sql
- security-checklist.md
- sop_ai_studio_agent.md
- sop_ai_studio_agent_chat_ops.md

Actions:
1. Add 018 and 028 to canonical migration run order.
2. Document ai_agent_conversation_state table, indexes, policy, and RPC contract.
3. Document retention clamp policy and cleanup cadence.
4. Add explicit function grant posture and “why service_role-only” rationale.
5. Add rollback notes and expected operator procedure.

Acceptance:
- Schema docs and migration docs both include 018/028.
- Security docs match runtime grants and call path.

## Phase 3: Route/Auth Contract Closure
Files:
- authGuard.ts
- README.md
- routes.md
- security-checklist.md
- agent-playbook.md

Actions:
1. Add /performance-soon and /character-soon to PROTECTED_ROUTES.
2. Synchronize all protected-route inventories to runtime source (authGuard.ts).
3. Remove stale “post-MVP/coming soon” statements where implementation is live.

Acceptance:
- Doc route protection lists are exact-match with code.
- Unauthenticated access to protected placeholders redirects to /auth.

## Phase 4: Instruction + Skill Layer Repair
Files:
- AGENTS.md
- AGENTS.md
- AGENTS.md
- dev-ground-rules.md
- conventions.md
- SKILL.md (target stale entries)

Actions:
1. Remove contradictory “client-only/no backend” statements where server API exists.
2. Normalize startup/install guidance across all instruction layers.
3. Replace stale frontend/pages/api/_utils/* references with current modules.
4. Add skill-path validity requirement and machine check.

Acceptance:
- No stale path references in skills.
- No architecture contradictions across AGENTS layers.

## Phase 5: Changelog + Archive Normalization
Files:
- change_log.md
- README.md
- pointer docs in docs/planning/ currently marked archived
- documentation_overview.md

Actions:
1. Convert changelog to Keep a Changelog format with top Unreleased.
2. Normalize dates to ISO YYYY-MM-DD.
3. Move unreliable historical chronology to a labeled legacy-import section.
4. Enforce archive policy: archived status markers only under docs/archive/.

Acceptance:
- No future-dated authoritative entries relative to 2026-02-20.
- Changelog structure is deterministic and machine-checkable.

## Phase 6: Semantic Drift Gates in CI
Files:
- check_docs_links.js
- check_docs_semantic_drift.js (new)
- package.json
- ci.yml
- pull_request_template.md
- .github/CODEOWNERS

Actions:
1. Extend docs checks to fail on semantic drift:
2. Route map vs actual pages.
3. Protected-route docs vs PROTECTED_ROUTES.
4. Migration file inventory vs migration docs/SOP/schema docs.
5. Skills referenced paths existence.
6. Timeless-language lint for authoritative docs.
7. Changelog date-format and chronology validation.
8. Add SQL lint gate using supabase db lint --fail-on warning where applicable.
9. Ensure unique CI job names across workflows.
10. Expand CODEOWNERS coverage to include .github/CODEOWNERS and core truth-chain docs.

Acceptance:
- PRs fail when docs and code diverge semantically.
- Required checks map cleanly in protected branch settings.

## Phase 7: ADR and API Contract Governance
Files:
- TEMPLATE.md
- README.md
- selected ADRs with stale assumptions
- api-internal-routes.md
- optional generated/openapi artifact path (to be added)

Actions:
1. Standardize ADR lifecycle states and required fields.
2. Mark superseded ADRs explicitly and link successors.
3. Introduce OpenAPI contract source for internal APIs (3.1.1 baseline).
4. Gate API doc drift against contract artifact in CI.

Acceptance:
- ADR metadata is consistent and queryable.
- API reference is contract-backed, not hand-maintained only.

## Important API/Interface/Type Changes
1. RPC access policy:
- public.upsert_ai_agent_conversation_state(...) execute path moves to service_role only.

2. RPC argument contract:
- p_ttl clamped to 1 day..90 days.
- p_user_cap clamped to 1..200.
- p_conversation_id max length enforced.

3. Route auth contract:
- /performance-soon and /character-soon become explicitly protected in runtime guard.

4. Docs CI contract:
- docs:check includes semantic parity checks, not only link/index checks.

5. SQL governance contract:
- supabase db lint becomes required for SQL-related PRs.

## Test Cases and Scenarios
1. Auth grant regression:
- Attempt RPC as authenticated role and confirm deny.
- Attempt RPC as service-role path and confirm success.

2. TTL/cap boundary tests:
- Send negative/huge TTL and cap; verify clamp behavior.

3. Retention determinism:
- Seed tie timestamps and verify intended row retention order.

4. Drift-check tests:
- Intentionally alter a protected-route doc line; confirm CI fails.
- Add migration file without docs update; confirm CI fails.
- Add stale skill path; confirm CI fails.

5. Changelog validation:
- Insert non-ISO date and future authoritative date; confirm CI fails.

6. Branch protection wiring:
- Validate required checks and code-owner review requirements enforce on PR.

## Assumptions and Defaults
1. Forward-only migration strategy; no historical migration rewriting.
2. authGuard.ts remains canonical route-protection source.
3. Default conversation TTL remains 30 days.
4. Max conversation ID length default is 191 unless product requirements mandate longer.
5. Hard-gate enforcement starts immediately after Phase 6 lands.
6. Legacy changelog entries are retained for traceability but labeled non-authoritative.

## External Best-Practice Anchors Applied
- PostgreSQL SECURITY DEFINER safety and default execute behavior:
  - https://www.postgresql.org/docs/16/sql-createfunction.html
  - https://www.postgresql.org/docs/18/sql-alterdefaultprivileges.html
- Supabase RLS/function execution posture and db lint:
  - https://supabase.com/docs/guides/database/postgres/row-level-security
  - https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A
  - https://supabase.com/docs/reference/cli/supabase-inspect-db-seq-scans
- Docs architecture/style:
  - https://diataxis.fr/
  - https://www.writethedocs.org/guide/docs-as-code/
  - https://developers.google.com/style/timeless-documentation
- Changelog/versioning:
  - https://keepachangelog.com/en/1.1.0/
  - https://semver.org/
- API contract standards:
  - https://spec.openapis.org/oas/v3.1.1.html
  - https://www.openapis.org/faq
- Review and merge controls:
  - https://docs.github.com/en/enterprise-server@3.17/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
  - https://docs.github.com/en/enterprise-server@3.19/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- Runbook/incident readiness:
  - https://sre.google/workbook/incident-response/
- ADR structure standardization:
  - https://adr.github.io/madr/
