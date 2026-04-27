# Plan Inventory

> Archived on 2026-04-27 during docs cleanup because this governance-baseline inventory is complete and the remaining active governance work lives in `docs/planning/master-rollout-proposal.md`, `docs/planning/implementation-tracker.md`, and `docs/planning/final-validation-summary.md`.

Date: 2026-02-20
Status: complete
Authority: Working
Owner: Engineering

## Source register

| Source ID | Plan name | Author | Date | Scope |
| --- | --- | --- | --- | --- |
| FP-2026-02-20 | Foundational Cleanup Plan | Source-provided | 2026-02-20 | Security + schema drift first; phased docs/governance/parity/modularity |
| KR-2026-02-20 | KEI Removal Plan v2 | Source-provided | 2026-02-20 | Compatibility-safe KEI decommission |
| DG-2026-02-20 | Documentation + Governance Realignment v2 | Source-provided | 2026-02-20 | Docs authority model + CI anti-drift |
| DM-2026-02-20 | Decoupling and Modularization Plan | Source-provided | 2026-02-20 | Architecture boundaries + modular decomposition + SQL hardening |

## Primary implementation surfaces

| Source ID | File paths and migrations | CI jobs and validations introduced | Compatibility windows | Rollback criteria |
| --- | --- | --- | --- | --- |
| FP-2026-02-20 | `sql/migrations/028_harden_ai_agent_conversation_state_security.sql`, `sql/migrations/rollback/028_harden_ai_agent_conversation_state_security_rollback.sql`, `frontend/lib/server/api/agentConversationState.ts` | strict gate: `lint`, `type-check`, `test`, `build`, `docs:check`, SQL validation | none explicit | revert phase PR only |
| KR-2026-02-20 | `frontend/features/ai-studio/hooks/useAiStudioTasks.ts`, `frontend/features/ai-studio/logic/stateParsers.ts`, `frontend/lib/keiClient.ts`, `frontend/pages/api/kei/*`, `frontend/lib/server/api/protectedApiPaths.ts` | runtime + auth coverage replacement before deletion | `/api/kei/*` tombstone hold for one release window | revert latest KEI phase only |
| DG-2026-02-20 | `docs/documentation_overview.md`, `docs/README.md`, `docs/planning/*`, `scripts/check_docs_semantic_drift.js`, `.github/workflows/ci.yml` | semantic docs drift + migration parity + chronology checks | warn/evaluate before enforce | downgrade checks to warn + revert CI PR |
| DM-2026-02-20 | `frontend/eslint.config.mjs`, architecture scripts, domain extraction targets | architecture boundary + file size budgets | wrapper compatibility for one release | revert split PR only |

## Governance references

- COBIT 2019
- ITIL 4
- ISO/IEC 38500:2024
- NIST CSF 2.0

## Decision locks

1. Forward-only migration strategy; historical `018` is immutable.
2. `028` is the conversation-state hardening migration.
3. DB-enforced retention bounds: TTL `1 day..90 days` (default `30 days`), cap `1..200` (default `200`).
4. `conversation_id` max length is `191`.
5. RPC name and return shape stay stable.
6. KEI deletion happens after compatibility window and coverage replacement.
7. New governance checks begin in warn/evaluate mode and promote to enforce after two green release cycles.
8. Required checks map to exact CI job IDs.
