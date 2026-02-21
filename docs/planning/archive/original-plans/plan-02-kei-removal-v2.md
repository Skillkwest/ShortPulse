## KEI Removal Plan v2 (Audit-Adjusted, Breakage-Safe)

### Summary
Yes. This revised plan explicitly includes a **stabilization-and-fix loop** in every phase, so any breakages discovered during KEI removal are fixed before progressing.  
Audit of the prior plan showed three gaps now corrected:
1. No explicit **compatibility hold period** before deleting KEI API stubs.
2. No hard **phase exit criteria** (pass/fail gates).
3. No required **coverage replacement** before deleting KEI tests.

This version applies best practices: phased decommission, compatibility window, required CI/ruleset guardrails, explicit rollback criteria, and regression tripwires.

---

## Phase 0: Safety Setup (No KEI deletion yet)
1. Create ADR: 0022-kei-decommission-plan.md with scope, timeline, rollback criteria.
2. Enable required branch protections/rulesets for:
- frontend job
- security job
- adaptive_media_gate when triggered
- ai_studio_perf_gate when triggered
3. Add/verify CODEOWNERS coverage for:
- frontend/features/ai-studio/**
- frontend/pages/api/**
- frontend/lib/server/api/**
- .github/workflows/**

**Exit criteria**
1. ADR merged.
2. Rulesets active.
3. Owner review enforcement confirmed.

---

## Phase 1: Remove Runtime KEI Callers, Keep API Tombstones
1. Remove frontend/runtime KEI usage while keeping /api/kei/* routes returning 410:
- Remove kei branches in useAiStudioTasks.ts.
- Remove KeiTaskStatus dependency from stateParsers.ts (make parser provider-agnostic).
- Remove "kei" from provider unions/types in runtime paths.
- Remove KEI constants/UI references from active UI files.
2. Keep KEI route files temporarily as tombstones (410) for one release window.
3. Remove any runtime imports of keiClient.ts; keep file only if required by remaining tests in this phase.

**Exit criteria**
1. npm -C frontend run lint passes.
2. npm -C frontend run type-check passes.
3. npm -C frontend run test passes.
4. npm -C frontend run build passes.
5. npm -C frontend run docs:check passes.

---

## Phase 2: Coverage Replacement Before KEI Test Deletion
1. Add/expand non-KEI tests to preserve behavior coverage currently validated by KEI tests:
- auth-guard behavior
- ownership checks
- status-poll safety logic
- disabled-route behavior parity (if relevant)
2. Update CI fast lane in ci.yml:
- remove kei-task-status.auth-context
- add equivalent non-KEI auth-context/ownership suite(s)
3. Validate no coverage drop in critical paths (auth/proxy/status ownership).

**Exit criteria**
1. Replacement tests merged and passing.
2. Fast lane still protects auth boundary regressions.
3. Full suite and build remain green.

---

## Phase 3: Delete KEI API and Client Surfaces
1. Delete:
- keiClient.ts
- create-task.ts
- task-status.ts
- status.ts
- gpt4o-generate.ts
2. Remove /api/kei/ from protectedApiPaths.ts.
3. Remove all KEI-only tests:
- frontend/tests/api/kei-*
- auth-guarded-ai-kei-routes.test.ts
4. Remove KEI references from e2e filtering if no longer needed.

**Exit criteria**
1. Zero imports/references to deleted surfaces in runtime and tests.
2. Full CI green.
3. Staging smoke tests green.

---

## Phase 4: Docs and Schema-Comment Cleanup
1. Update active docs and SOPs to remove KEI operational guidance.
2. Update schema/documentation comments (fal | kei | ...) to current provider set.
3. Keep historical changelog entries intact (history, not operational guidance).

**Exit criteria**
1. docs:check passes.
2. No KEI mention in active runtime docs/SOPs (allowlist only for changelog/history files).

---

## Phase 5: Permanent Anti-Regression Guardrails
1. Add CI forbidden-reference check:
- Fail on kei|kie in runtime paths:
  - frontend/features/**
  - frontend/lib/**
  - frontend/pages/api/**
  - .github/workflows/**
- Allowlist:
  - change_log.md
  - optional historical ADRs/planning archives
2. Add lint guard:
- no-restricted-imports for frontend/lib/keiClient.
3. Add a short “provider retirement checklist” section in agent-playbook.md.

**Exit criteria**
1. Reintroduction PR intentionally inserting KEI token fails CI.
2. Guardrail docs merged.

---

## Public API / Interface / Type Changes
1. Internal API endpoints removed:
- /api/kei/create-task
- /api/kei/task-status
- /api/kei/status
- /api/kei/gpt4o-generate
2. Removed client API:
- fetchKeiTaskStatus
- createKeiTask
- createKeiGpt4oTask
- KeiTaskStatus
3. Provider/type contracts:
- "kei" removed from provider unions in runtime code.
4. Auth protected prefix:
- "/api/kei/" removed from protected path map.

---

## Test Cases and Scenarios
1. Build integrity
- No unresolved imports/types after KEI deletions.
2. Runtime generation flow
- Fal generation submit/poll success paths.
- Fal failure/ownership paths.
3. Auth boundary
- Protected API auth and middleware context behavior unchanged.
4. CI behavior
- Fast lane still catches auth/ownership regressions.
- Adaptive/perf gates still run based on path filters.
5. Regression trap
- Forbidden-reference job fails on KEI reintroduction.

---

## Rollout, Monitoring, and Rollback
1. Deploy order
- Merge Phase 1–2 changes first, observe one release window.
- Merge Phase 3 deletion after no meaningful /api/kei/* traffic.
2. Monitor (24–48h per major phase)
- 4xx/5xx API rates
- generation failure rate
- auth/ownership denial anomalies
3. Rollback trigger defaults
- sustained generation failure increase >20% over baseline for 30 min
- auth errors spike >2x baseline for 30 min
4. Rollback action
- revert latest phase PR only (phase-isolated rollback).

---

## Assumptions and Defaults
1. KEI is permanently retired.
2. Historical DB rows with provider='kei' are retained (no data rewrite in this cleanup).
3. Changelog history is preserved.
4. Cleanup is executed as **phased PRs** (not one big-bang PR).
5. Compatibility hold for /api/kei/* tombstones lasts **one release window** before deletion.
