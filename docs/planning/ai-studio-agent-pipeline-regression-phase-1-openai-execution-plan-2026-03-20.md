# AI Studio Agent Prompt-Compiler Hardening - Phase 1 OpenAI Execution Plan

Date: 2026-03-20  
Authority: Working  
Owner: AI Platform + Frontend  
Status: Planned (rebaselined to master roadmap; implementation pending)

## Summary
Phase 1 establishes deterministic outcome contracts and cross-route policy parity for OpenAI agent lanes.  
The objective is to remove fallback/refusal ambiguity and ship a stable machine-readable behavior layer that Phase 2 can build on.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope:
1. `fal-submit` implementation changes.
2. Full compiler IR rollout (reserved for later master-governed execution slices).

Master references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/evidence/agent-pipeline-remediation/master/README.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`
5. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-route-outcome-contract-2026-03-20.md`

## Phase 1 Scope Lock
1. Preserve existing HTTP status behavior and backward compatibility for current clients.
2. Additive contract changes only for route payloads/telemetry.
3. No schema/database migrations.
4. OpenAI-only execution scope.

## Execution Gate Dependencies
Phase 1 implementation may begin when these master rows are approved:
1. `M-01` (IR/object contract baseline sufficient for route outcome metadata).
2. `M-02` (bounded fail-closed behavior contract).
3. `M-08` (reason-code taxonomy contract).
4. `M-09` (runtime precedence order and proof tests baseline).

## Implementation Decisions
1. Outcome contract standardization across all in-scope routes:
   - Additive fields: `decision`, `outcome_class`, `reason_code`, `retryable`.
   - Required mapping for success/refusal/fallback/error categories.
2. Shared mapping helper:
   - One server-side classification/mapping utility drives all OpenAI lanes.
   - Route-specific ad hoc mapping is removed from user-lane behavior decisions.
3. Client behavior alignment:
   - Client prioritizes machine fields over fragile message-string heuristics.
   - Backward-compatible fallback parsing remains as a compatibility lane.
4. Observability lock:
   - Telemetry includes stable outcome and reason-code fields for parity checks.
   - Baseline trace packet must show machine-distinguishable refusal vs fallback outcomes.

## Work Breakdown
1. Baseline and freeze:
   - Capture representative failing traces for fallback/refusal confusion.
   - Freeze relevant safety/runtime flag changes during Phase 1 implementation window.
2. Server contract implementation:
   - Implement shared outcome/reason mapping helper.
   - Apply contract to `studio-agent`, `generate-prompt`, and `describe-image`.
3. Client handling update:
   - Consume machine-readable outcome fields first.
   - Preserve legacy fallback behavior where machine fields are absent.
4. Docs and evidence:
   - Record final outcome taxonomy contract and route mapping matrix.
   - Store all packets in `docs/planning/evidence/agent-pipeline-remediation/phase-1/`.

## Validation
1. API contract tests:
   - Assert route payload fields for success, safety refusal, infra fallback, and hard-error paths.
2. Client tests:
   - Assert machine-field precedence.
   - Assert compatibility behavior when additive fields are missing.
3. Cross-route parity suite:
   - Golden corpus classification parity across all in-scope routes.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`

## Exit Criteria
1. Cross-route outcome and reason-code parity is green for the in-scope corpus.
2. Baseline failing traces now resolve through deterministic machine-classified paths.
3. No non-additive contract regressions for existing route consumers.
4. Master tracker row `PX-01` is complete with phase evidence links.
