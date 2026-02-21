# Foundational Cleanup Plan (Security + Schema Drift First)

## Brief Summary
This plan runs a phased cleanup program with strict gates, starting with security and schema/runtime parity, then documentation/governance consistency, then structural debt reduction. It is designed to avoid risky “big bang” changes and keep rollback paths clear.

## Locked Decisions
- Wave 1 focus: Security + schema drift.
- Rollout style: Phased PR train.
- Quality gate: Strict (lint, type-check, tests, docs-check, targeted SQL/runtime validations).

## Phase Plan
1. **Phase 0: Baseline And Guardrails**
- Create a single cleanup tracking doc under docs/planning/ that maps findings to phases and acceptance criteria.
- Freeze baseline evidence: current route inventory, API inventory, migration inventory, and oversized file inventory.
- Define merge rule: no phase merges without passing strict gate and phase-specific checks.

2. **Phase 1: SQL/RPC Hardening For Conversation State (018)**
- Add a new forward migration (do not edit historical 018) to harden ai_agent_conversation_state and upsert_ai_agent_conversation_state.
- Keep RPC name and return shape stable for compatibility.
- Enforce bounded retention in DB logic (caller cannot bypass bounds).
- Make prune order deterministic.
- Add explicit conversation_id length constraint.
- Tighten function hardening (SECURITY DEFINER hygiene and privilege scope).
- Remove unnecessary authenticated execute grant if app usage is server-only.

3. **Phase 2: Schema/Runtime/Docs Parity**
- Update migration runbooks so required/current migration sets are accurate for agent canonical state and current runtime.
- Add ai_agent_conversation_state and RPC contract to data-dictionary.md.
- Update supabase_full_schema.sql (or explicitly declare canonical migration-first policy and align all docs to that policy).
- Align security docs with actual auth boundaries and protected route behavior.
- Fix README architecture contradiction (“client-only/no backend” vs internal API routes).

4. **Phase 3: Documentation Governance Drift Cleanup**
- Fix stale ESLint guidance (.eslintrc.json reference) to current flat config.
- Reconcile route inventories across README.md, routes.md, and security docs.
- Reconcile API inventory in docs with actual frontend/pages/api/*.
- Normalize “source-of-truth” locations to avoid conflicting top-level guidance.

5. **Phase 4: Automation To Prevent Re-Drift**
- Add automated checks for route-doc parity (pages and API routes).
- Add migration-doc parity check (filesystem migrations vs documented required/current lists).
- Extend npm run docs:check to include the new parity checks.
- Make CI fail on parity drift.

6. **Phase 5: Structural Debt Reduction (Modularity Pass)**
- Prioritize top high-risk oversized files by churn + blast radius.
- Split incrementally by concern (UI/render, state wiring, side effects, provider adapters).
- Enforce file-size and comment conventions during each split PR.
- Keep behavior unchanged; no feature changes in modularization PRs.

## Public APIs / Interfaces / Types Changes
- SQL RPC public.upsert_ai_agent_conversation_state:
  - Name unchanged.
  - Return table unchanged.
  - Behavior changed to enforce server-owned bounds for TTL/cap.
  - Deterministic pruning order introduced.
- DB constraints:
  - Add explicit conversation_id max length check.
- Privileges:
  - Revoke broad execution/access not required by runtime path.
- No frontend API path changes are planned in Wave 1.

## Test Cases And Scenarios
1. **SQL security behavior**
- Authenticated caller cannot bypass retention bounds via oversized TTL/cap.
- Caller cannot write/update rows for another user.
- Direct table write path cannot bypass intended policy model (if table access is restricted).

2. **SQL correctness**
- Upsert inserts on first turn, updates on subsequent turns, increments turn_count.
- Expired rows are pruned.
- Per-user row-cap pruning is deterministic under timestamp ties.

3. **Runtime compatibility**
- studio-agent canonical read/write path works with hardened RPC unchanged from app perspective.
- No regression in agent turn flow when canonical DB flag is enabled.
- Fallback behavior remains safe when DB or RPC is unavailable.

4. **Docs/runtime parity**
- Route docs match actual pages.
- API docs match actual handlers.
- Migration docs match actual required/current migration state.

5. **Governance automation**
- New parity checks fail intentionally on seeded drift fixture and pass on aligned state.

## Acceptance Criteria By Phase
- Phase 1 is complete when security bounds and deterministic pruning are DB-enforced and validated.
- Phase 2 is complete when docs, schema references, and runtime assumptions are consistent.
- Phase 3 is complete when top-level guidance has no contradictions.
- Phase 4 is complete when drift checks are automated and enforced in CI.
- Phase 5 is complete when selected oversized files are split with no behavior regressions.

## Rollout And Risk Controls
- One PR per phase (or smaller sub-PRs inside a phase) with explicit rollback notes.
- Staging-first SQL validation before production migration.
- Keep emergency fallback: STUDIO_AGENT_CANONICAL_DB_ENABLED=false for runtime mitigation if needed.
- Require green strict gate plus phase-specific checks before merge.

## Assumptions And Defaults
- Runtime canonical state is server-owned (service-role path), not client-direct.
- Existing RPC name must remain stable to minimize application churn.
- Cleanup is non-feature work; behavior should remain functionally equivalent unless explicitly security-hardening.
- Migration strategy is forward-only with rollback scripts when feasible.
