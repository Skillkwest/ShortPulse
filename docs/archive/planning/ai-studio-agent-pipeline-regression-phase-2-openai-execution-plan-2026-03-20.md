# AI Studio Agent Prompt-Compiler Hardening - Phase 2 OpenAI Execution Plan

> Archived on 2026-04-27 during docs cleanup because Phase 2 is complete and the active remediation family now continues from the master roadmap, tracker, and remaining live Phase 1/Phase 4 contracts in `docs/planning/`.

Date: 2026-03-20  
Authority: Working  
Owner: Frontend + AI Platform  
Status: complete

## Summary
Phase 2 hardens prompt quality and canonical continuity while narrowing safety precheck blast radius.  
It converts Phase 1 outcome clarity into continuity-safe runtime behavior for OpenAI lanes.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope:
1. Fal provider migration or endpoint-family expansion.
2. Fal payload-contract redesign.

Scope amendment (2026-03-20):
1. Limited shared precheck parity updates touched Fal submit route wiring/tests to keep shared safety-lane behavior aligned across runtime entry points.
2. No provider integration contract changes were introduced.
3. Owner-directed runtime-truth scope for Phase 2 closeout is local + staging; production capture is deferred.

Master references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`

## Phase 2 Scope Lock
1. Keep HTTP status and route envelope compatibility.
2. Preserve server-authoritative safety decision model.
3. OpenAI-only scope.
4. No schema/database migrations.

## Execution Gate Dependencies
Phase 2 implementation may begin when these gates are met:
1. Phase 1 exit criteria are fully green.
2. Master rows `M-04`, `M-05`, `M-06`, `M-09`, and `M-12` are approved or explicitly waived with risk signoff.
3. Outcome/reason taxonomy from Phase 1 is stable in staging.

## Execution Discipline (No-Bloat / No-Regression)
1. Execute in small vertical slices only (single behavior contract per slice).
2. Start each slice with an explicit contract statement:
   - inputs and outputs,
   - invariants to preserve,
   - expected failure behavior.
3. Add or update targeted tests for touched logic before implementation changes.
4. Keep diffs minimal and scoped; no opportunistic refactors outside the active slice.
5. Validation per slice:
   - targeted tests for touched paths,
   - `npm -C frontend run type-check`.
6. Validation at phase checkpoint/closeout:
   - `npm -C frontend run lint`,
   - `npm -C frontend run build`,
   - `npm -C frontend run docs:check`.
7. After each slice, perform a self-audit for:
   - regression risk,
   - code/documentation bloat risk,
   - contract drift between implementation and planning docs.

## Implementation Decisions
1. Precheck enforcement scope contract:
   - Hard refusal scope: latest user turn + canonical prompt.
   - Context/reference memory fields are non-blocking by default (`rewrite_only` or `shadow` based on gate setting).
2. Client/server parity:
   - Client and server precheck scope defaults and rewrite-recheck semantics must match.
   - Remove implicit default divergence between client and server safety lanes.
3. Canonical continuity protection:
   - Do not promote infra fallback assistant text into canonical continuity state.
   - Canonical state commits occur only from validated prompt outputs.
4. Runtime truth discipline:
   - Collect and archive profile/flag/control-plane snapshots for local and staging for this phase scope.

## Work Breakdown
1. Scope contract implementation:
   - Add scoped precheck behavior controls and route wiring for OpenAI lanes.
   - Add field-level telemetry to distinguish refusal-enforced fields from rewrite/shadow-only fields.
2. Continuity hardening:
   - Add canonical commit guards for fallback/error turns.
   - Harden session namespace and mode-switch continuity paths.
3. Quality and continuity test expansion:
   - Add targeted tests for canonical/context/reference precheck interactions.
   - Add explicit tests for image-only sends and post-fallback edit continuity.
4. Evidence and reporting:
   - Produce golden quality delta report and false-refusal delta report.
   - Archive runtime truth packets in `docs/planning/evidence/agent-pipeline-remediation/phase-2/`.

## Progress Update (2026-03-20)
Completed:
1. Precheck enforcement scope contract implemented (`latest_user_turn` + `canonical_prompt` enforced; history/context/reference non-blocking by default).
2. Field-level precheck telemetry emitted (`refusal_field`, `rewritten_fields`, `non_blocking_signal_count`).
3. Runtime-configurable field-mode overrides added (shared + route-scoped server knobs and client mirror knobs).
4. Route-level override coverage added for `studio-agent`, `generate-prompt`, and Fal submit precheck parity.

Evidence:
1. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-precheck-scope-parity-progress.md`
2. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-continuity-guard-validation.md`
3. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-quality-refusal-and-runtime-truth-local-baseline.md`
4. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-runtime-truth-staging-packet.md`
5. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-golden-quality-false-refusal-comparative-report.md`
6. `docs/planning/evidence/agent-pipeline-remediation/phase-2/2026-03-20-phase-2-closeout-packet-staging-scope.md`

## Validation
1. Safety scope tests:
   - Refusal on unsafe latest-user/canonical cases.
   - Non-refusal for unsafe context/reference under default Phase 2 scope.
2. Continuity tests:
   - Session switch and namespace reset invariants.
   - Image-only and mixed-turn continuity behavior.
   - No canonical pollution from fallback lanes.
3. Quality gates:
   - Golden prompt quality suite delta is non-regressing.
   - False-refusal rate does not increase relative to baseline.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`

## Exit Criteria
1. Precheck scope contract is enforced and parity-tested across OpenAI routes.
2. Prompt continuity metrics meet or exceed baseline.
3. No net increase in false-positive refusals on the approved corpus.
4. Runtime truth packets (`local`, `preview`, `production`) are captured and linked.
   - scope amendment: `local` + `staging` captured for this phase closeout.
5. Master tracker row `PX-02` is complete with phase evidence links.
