# AI Studio Agent Prompt-Compiler Hardening - Phase 4 OpenAI Execution Plan

Date: 2026-03-20  
Authority: Working  
Owner: Platform Ops + AI Platform + Frontend  
Status: In Progress (staging readiness tooling implementation in progress; production rollout still deferred by staging-only directive)

## Summary
Phase 4 executes controlled production activation and operational closeout for the OpenAI prompt-compiler lanes.  
It converts Phase 3 governance controls into a release sequence with explicit hold, rollback, and signoff gates.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope:
1. `fal-submit` implementation changes.
2. Provider migration or multi-provider routing expansion.
3. New schema/database migrations outside approved master waivers.

Scope amendment (2026-03-20):
1. Active owner directive remains staging-only; production ring execution is deferred until directive changes.
2. Phase 4 entry work may continue as documentation/readiness preparation only while the staging-only directive is active.

Implementation progress addendum (2026-03-21):
1. Added strict multi-route staging lane audit coverage for:
   - `/api/ai/studio-agent`
   - `/api/ai/generate-prompt`
   - `/api/ai/describe-image`
2. Added bundled lane orchestrator:
   - `scripts/audit_staging_openai_lane_bundle.mjs`
3. Added frontend runnable commands:
   - `npm -C frontend run audit:staging:openai-lanes`
   - `npm -C frontend run audit:staging:openai-lanes:strict`
   - `npm -C frontend run audit:staging:openai-lanes:strict:lineage`
4. Added bundle-level lineage precheck gate (route parity + deployment-age/freshness checks) to fail fast on stale staging alias lineage.
5. Unified `Agent-Contract-Version: 1` header emission across OpenAI remediation routes to support strict cross-route contract gating.
6. Current staging blocker remains deployment lineage drift (staging alias not yet on latest remediation commit set).

Master references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-3-openai-execution-plan-2026-03-20.md`
4. `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`
5. `docs/planning/ai-studio-agent-pipeline-regression-authority-precedence-addendum-2026-03-20.md`
6. `docs/planning/ai-studio-agent-pipeline-regression-tracker-gate-clarification-2026-03-20.md`
7. `docs/planning/ai-studio-agent-pipeline-regression-supporting-docs-plan-2026-03-20.md`
8. `docs/planning/ai-studio-agent-pipeline-regression-environment-label-normalization-2026-03-20.md`

## Phase 4 Scope Lock
1. Release and stabilization only; no new architecture expansion in this phase.
2. All Phase 3 precedence/canary/rollback controls are mandatory and non-optional.
3. OpenAI-only production rollout scope.
4. Additive operational changes only (runbooks, thresholds, alert routing, rollout state).

## Execution Gate Dependencies
Phase 4 implementation may begin when these gates are met:
1. Phase 3 exit criteria are fully green.
2. Master row `M-15` signoff packet is approved (or explicitly waived with risk signoff).
3. Canary and rollback runbooks are verified in staging with evidence attached.

## Implementation Decisions
1. Ringed rollout contract:
   - Rollout order is fixed: internal verification -> preview canary -> production canary -> production broad rollout.
   - Each ring has explicit hold duration and promotion/rollback criteria.
2. SLO and error-budget gating:
   - Promotion decisions must use locked compiler-native metrics (`schema`, `fallback`, `false-refusal`, `repair` deltas) plus latency/error SLO checks from the threshold contract.
   - If thresholds breach, promotion halts and rollback protocol executes.
3. Incident and ownership model:
   - On-call ownership, escalation path, and command channel are fixed before production canary.
   - Incident packets must distinguish policy refusal shifts from infra degradation.
4. Closeout and steady-state handoff:
   - Temporary rollout toggles are documented with explicit target state.
   - Final operator handoff includes runbooks, dashboards, thresholds, and evidence pointers.

## Work Breakdown
1. Release readiness packet:
   - Build launch checklist from Phase 3 artifacts.
   - Freeze non-essential policy/config changes during rollout window.
2. Ring execution:
   - Execute internal/preview/production rings with checkpoint signoffs.
   - Capture control-vs-ring metric deltas at each promotion gate.
3. Stabilization and triage:
   - Run post-rollout observation window with daily decision logs.
   - Track and close critical regressions before broad rollout completion.
4. Program closeout:
   - Publish closeout packet and operational handoff.
   - Mark phase completion in master tracker with evidence links.

## Validation
1. Rollout gates:
   - Ring-by-ring promote/hold/rollback decisions are evidence-backed.
   - No unapproved threshold bypasses.
2. Production stability:
   - No sustained threshold breach during stabilization window.
   - Incident runbook execution is validated when triggered.
3. Operational handoff:
   - Dashboards, alerts, and escalation ownership are confirmed.
   - Closeout packet and release recommendation are approved.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`
   - `npm -C frontend run audit:staging:openai-lanes:strict:lineage -- --samples 10 --concurrency 1 --request-timeout-ms 60000`
   - `npm -C frontend run audit:staging:openai-lanes:strict -- --samples 10 --concurrency 1 --request-timeout-ms 60000`

## Exit Criteria
1. Production rollout completes with ring-gate evidence and no unresolved critical regressions.
2. Stabilization window closes with metrics at or below approved risk thresholds.
3. Operational handoff packet is complete and accepted by owning teams.
4. Master tracker row `PX-04` is complete with phase evidence links.
