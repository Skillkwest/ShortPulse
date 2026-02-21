# ShortPulse Decoupling and Modularization Plan (Audited + Rewritten, Feb 20, 2026)

## Summary
This rewrite closes gaps in the previous plan by adding missing best-practice controls for:
1. Enforceable architecture boundaries in CI, not just guidelines.
2. SQL concurrency and security hardening for conversation-state RPC.
3. Explicit legacy-compat deprecation gates so mixed-schema coupling is removed.
4. Rollout/rollback criteria tied to existing ADR 0020 and 0021 controls.
5. Decision-complete module targets and acceptance checks per hotspot.

## Scope
### In scope
1. Internal architecture boundaries and dependency direction.
2. Shared domain extraction to remove server↔feature coupling.
3. Runtime authority convergence (server-only lifecycle/recovery decisions).
4. Monolith decomposition for identified hotspots.
5. SQL function hardening for upsert_ai_agent_conversation_state.
6. Test, CI, and observability guardrails for regression prevention.

### Out of scope
1. Router migration (Pages Router stays).
2. Public endpoint path changes.
3. Product UX redesign.

## Target Architecture (Final Boundary Contract)
1. frontend/lib/domain/** is the only shared business-logic layer used by server and features.
2. frontend/lib/server/** may import frontend/lib/domain/** and server utilities only.
3. frontend/features/** may import frontend/lib/domain/** and feature-local modules only.
4. frontend/pages/** remain composition/adapters only; no embedded business logic.
5. Runtime lifecycle state ownership is server-only; client reads normalized snapshots.

## Workstream 0: Hard Guardrails First
1. Add import boundary rules in eslint.config.mjs using no-restricted-imports.
2. Add dependency graph enforcement using dependency-cruiser with forbidden edges:
   - frontend/lib/server/** -> frontend/features/**
   - frontend/lib/server/** -> frontend/pages/**
   - cross-feature forbidden imports except explicit shared contracts.
3. Add CI architecture job in ci.yml running boundary lint + dependency-cruiser.
4. Add size-budget check script and CI gate:
   - API files: 500 LOC hard cap
   - hooks: 400 LOC hard cap
   - UI components: 800 LOC hard cap
   - temporary exceptions require ADR note.
5. Add circular-dependency gate (import/no-cycle or dep-cruiser cycle rule).

## Workstream 1: Shared Domain Extraction (Branch-by-Abstraction)
1. Create canonical modules:
   - frontend/lib/domain/models/*
   - frontend/lib/domain/agent/*
   - frontend/lib/domain/media/*
   - frontend/lib/domain/generation/*
2. Migrate current leaks to domain contracts:
   - generationBilling.ts
   - pricingParams.ts
   - generationSubmitPersistence.ts
   - mediaMoveService.ts
   - move.ts
   - move-batch.ts
   - studio-agent.ts
   - generate-prompt.ts
3. Keep temporary compatibility wrappers for one release only.
4. Remove wrappers after parity tests pass and CI shows zero forbidden edges.

## Workstream 2: Runtime Authority Convergence
1. Define one canonical server runtime snapshot type in runtimeSnapshot.ts.
2. Remove client-owned background recovery scheduling from useAiStudioTasks.ts; client becomes render + request layer only.
3. Centralize recovery/retry/settlement policy in server runtime modules:
   - recoveryExecution.ts
   - falStatusProxy.ts
4. Keep ADR flags as rollout controls:
   - SHORTPULSE_FAL_INTEGRATION_MODE
   - webhook verification flags from ADR 0021.
5. Add idempotency contract for submit/recovery/settlement paths and enforce atomic side-effect writes.

## Workstream 3: Hotspot Decomposition
1. ai-studio.tsx split into page shell + composition + dev/perf harness module.
2. useAiStudioState.ts split into state slices:
   - output state
   - workflow settings
   - reference assets
   - agent context
   - archive policy.
3. useAiStudioTasks.ts split into:
   - provider adapter
   - status normalization
   - polling scheduler
   - UI output updater.
4. studio-agent.ts split into:
   - request validation
   - orchestration/context
   - model execution
   - response normalization
   - persistence.
5. ReferenceCanvas.tsx split by subsystem:
   - render/hydration
   - autoplay
   - drag/drop
   - telemetry.

## Workstream 4: SQL/RPC Hardening for Conversation State
1. Keep existing RPC name/signature for compatibility.
2. Add bounded TTL policy inside function:
   - default 30 days
   - min 1 day
   - max 90 days.
3. Add bounded row-cap policy:
   - default 200
   - min 1
   - max 1000.
4. Make pruning deterministic:
   - ORDER BY updated_at DESC, conversation_id DESC.
5. Add per-user concurrency serialization for upsert/prune using transaction-scoped advisory lock keyed by user.
6. Keep SECURITY DEFINER but harden with SET search_path = public, pg_temp.
7. Add periodic expiry cleanup job (pg_cron or existing scheduler).
8. Remove legacy RPC-signature fallback in agentConversationState.ts after all envs include migration 018.

## Workstream 5: CI, Tests, and Regression Guardrails
1. Add architecture tests:
   - forbidden import edges
   - cycle detection
   - module-size budget checks.
2. Add runtime contract tests:
   - lifecycle transition matrix
   - idempotency duplicate-submit duplicate-webhook duplicate-settlement scenarios
   - out-of-order status event handling.
3. Add SQL tests for conversation state:
   - auth checks
   - TTL bound enforcement
   - row-cap bound enforcement
   - deterministic eviction tie behavior
   - concurrent upsert behavior.
4. Add parity tests for canonical model registry usage across submit/status/recovery/billing.
5. Promote gates from warning to enforce after two green release cycles.

## Public APIs, Interfaces, and Type Changes
1. Introduce internal GenerationRuntimeSnapshot and transition types as canonical server/client contract.
2. Introduce internal canonical model profile types under frontend/lib/domain/models.
3. Preserve public HTTP route paths and response shape compatibility during migration.
4. Preserve RPC function signature; behavior hardens via bounded validation and deterministic pruning.
5. Remove legacy RPC fallback behavior post-migration convergence.

## Rollout Plan
1. Release 1: Workstream 0 guardrails in warn mode + Workstream 1 scaffolding.
2. Release 2: Complete Workstream 1 + partial Workstream 2 behind existing runtime flags.
3. Release 3: Complete Workstream 2 + top 3 hotspot splits from Workstream 3.
4. Release 4: Remaining Workstream 3 + Workstream 4 SQL hardening migration.
5. Release 5: Workstream 5 enforce mode + compatibility wrapper removal.

## Acceptance Criteria
1. rg check for server→feature imports returns zero matches.
2. AI Studio client has no background recovery ownership code.
3. Recovery/settlement idempotency tests pass under retries and duplicate events.
4. SQL function tests confirm bounded TTL/cap and deterministic eviction.
5. Monolith files are below budgets or documented ADR exceptions.
6. CI enforces architecture policy on every PR.

## Assumptions and Defaults
1. Existing ADR 0020 and 0021 remain authoritative.
2. Supabase is the persistent store for lifecycle and conversation state.
3. Default retention remains 30 days for product behavior.
4. Backward compatibility is maintained for one release via adapters/wrappers.
5. No feature freeze; refactors are incremental and gated.

## Source-Backed Best-Practice Basis
1. PostgreSQL CREATE FUNCTION security-definer/search-path guidance: https://www.postgresql.org/docs/current/sql-createfunction.html
2. PostgreSQL row-security semantics: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
3. PostgreSQL explicit/advisory locking: https://www.postgresql.org/docs/current/explicit-locking.html
4. PostgreSQL deterministic ordering expectations (ORDER BY): https://www.postgresql.org/docs/current/sql-select.html
5. Supabase RLS guide: https://supabase.com/docs/guides/database/postgres/row-level-security
6. Supabase database functions: https://supabase.com/docs/guides/database/functions
7. Supabase cron scheduling: https://supabase.com/docs/guides/cron
8. ESLint restricted imports: https://eslint.org/docs/latest/rules/no-restricted-imports
9. dependency-cruiser rules and forbidden dependency checks: https://github.com/sverweij/dependency-cruiser
10. React state-structure and reducer/context modularization: https://react.dev/learn/choosing-the-state-structure and https://react.dev/learn/scaling-up-with-reducer-and-context
11. TypeScript exhaustive union checking: https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html
12. Stripe idempotency and webhook reliability practices: https://docs.stripe.com/api/idempotent_requests and https://docs.stripe.com/webhooks
13. AWS Builders’ Library retry safety/idempotency: https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/
