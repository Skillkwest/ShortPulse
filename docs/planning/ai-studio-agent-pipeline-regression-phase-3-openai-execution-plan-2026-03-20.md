# AI Studio Agent Prompt-Compiler Hardening - Phase 3 OpenAI Execution Plan

Date: 2026-03-20  
Authority: Working  
Owner: Platform Ops + Platform + AI Platform  
Status: Planned (rebaselined to master roadmap; implementation pending)

## Summary
Phase 3 operationalizes rollout governance for the OpenAI prompt-compiler lanes.  
It finalizes precedence, observability, canary controls, and rollback readiness so production changes are measurable and reversible.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope:
1. `fal-submit` implementation changes.
2. Provider migration or policy-envelope expansion outside approved matrix.

Master references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-phase-2-openai-execution-plan-2026-03-20.md`
5. `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`
6. `docs/planning/ai-studio-agent-pipeline-regression-authority-precedence-addendum-2026-03-20.md`
7. `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`

## Phase 3 Scope Lock
1. No user-facing behavior changes without canary approval.
2. Contracts for precedence/reason-codes/telemetry are stable and additive-only.
3. OpenAI-only scope.
4. No schema/database migrations unless explicitly approved under master gate waivers.

## Execution Gate Dependencies
Phase 3 implementation may begin when these gates are met:
1. Phase 1 and Phase 2 exit criteria are fully green.
2. Master rows `M-07` through `M-14` are approved or explicitly waived with risk signoff.
3. Staging runtime truth packet is complete and reviewed.

## Implementation Decisions
1. Runtime precedence contract:
   - Lock and test precedence resolution for env/control-plane/profile/request/killswitch behavior.
   - Prevent silent drift with deterministic precedence test coverage.
2. Cache and config safety:
   - Enforce version-safe cache key policy (prompt/schema/control-plane version signals).
   - Document and test cache invalidation triggers for policy/template/schema changes.
3. Canary controls:
   - Define stop/go thresholds for schema-failure delta, fallback-rate delta, false-refusal delta, and repair-rate delta.
   - Enforce canary hold/rollback decisions from thresholds, not ad hoc interpretation.
4. Rollback readiness:
   - Execute rollback drill packet for policy/profile/config rollback.
   - Require reproducible rollback evidence and post-drill integrity checks.
5. Observability contract:
   - Ensure outcome/reason/decision telemetry is complete for all in-scope routes.
   - Publish operations packet linking traces, thresholds, and runbook actions.
6. Simulation gate policy:
   - Treat safety simulation runs as staging smoke gates, not primary quality gates.
   - Run matrix checks once per major checkpoint (or when policy/runtime plumbing changes).
   - Keep deterministic tests and golden fixtures as the authoritative regression signal.

## Work Breakdown
1. Precedence and cache governance:
   - Implement precedence proof tests and cache-key parity tests.
   - Document precedence table and invalidation contract in canonical docs.
2. Canary policy and alerts:
   - Build canary evaluation packet with control-vs-canary deltas.
   - Wire alert thresholds for compiler-native risk indicators.
3. CI and evaluation enforcement:
   - Add parity and precedence checks to required CI policy bundle.
   - Add nightly matrix/eval coverage for envelope drift and refusal/fallback changes.
4. Rollback drill and closeout:
   - Run staged rollback drill and capture full evidence packet.
   - Record decision outcomes and release recommendation.

## Validation
1. Governance tests:
   - Precedence determinism tests.
   - Cache invalidation and version-key parity tests.
2. Canary packet validation:
   - Control-vs-canary metric deltas within approved thresholds.
   - No threshold breaches on schema/fallback/refusal/repair deltas.
3. Rollback validation:
   - Successful rollback drill and post-rollback integrity verification.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`

## Exit Criteria
1. Precedence and cache contracts are documented, tested, and enforced in CI.
2. Canary window passes all threshold gates with evidence attached.
3. Rollback drill passes and archive packet is complete.
4. Master tracker row `PX-03` is complete with phase evidence links.
