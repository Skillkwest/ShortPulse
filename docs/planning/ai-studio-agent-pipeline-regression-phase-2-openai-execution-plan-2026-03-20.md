# AI Studio Agent Pipeline Regression - Phase 2 OpenAI Execution Plan

Date: 2026-03-20  
Authority: Working  
Owner: Frontend + AI Platform  
Status: Planned (decision complete, implementation pending)

## Summary
This is the decision-complete execution plan for Phase 2 of the agent pipeline remediation program.  
Phase 2 scope is limited to OpenAI agent activity and related client/runtime continuity behavior.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope for this phase:
1. All `fal-submit` routes and generation-submit precheck behavior changes.

Program references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-pipeline-regression-phase-1-openai-execution-plan-2026-03-20.md`

## Scope Lock
1. Keep HTTP status behavior and route envelopes backward-compatible.
2. No schema migrations in this phase.
3. Preserve server authority for safety decisions.
4. Restrict behavior changes to OpenAI lanes and shared precheck logic used by those lanes.

## Implementation Decisions
1. Precheck enforcement contract for OpenAI lanes:
   - Hard refusal applies to `latest user turn` and `canonicalPrompt` only.
   - `context.activePrompt`, `context.lastAssistantMessage`, `references[].promptSnippet`, and `references[].caption` are non-blocking in Phase 2 (`rewrite_only` by default).
2. Client/server alignment:
   - Client pre-send precheck assumptions must mirror server scope defaults for OpenAI lanes.
   - Rewrite recheck behavior must be explicitly aligned (no implicit default divergence).
3. Continuity preservation:
   - Prevent infra fallback assistant copy from contaminating canonical continuity paths.
   - Preserve canonical/session continuity through prompt-edit loops, image-only sends, and session namespace changes.
4. Runtime truth gating:
   - Require environment truth packets for `local`, `preview`, and `production` before rollout and at closeout.

## Work Breakdown
1. Scope contract and guardrails:
   - Implement scoped precheck evaluation modes (`refusal` vs `rewrite_only`/`shadow`) for targeted fields.
   - Add explicit defaults and guard knobs for scope behavior.
2. OpenAI lane wiring:
   - Apply the scoped contract consistently in `studio-agent`, `generate-prompt`, and `describe-image` paths.
   - Keep existing refusal text and compatibility semantics intact.
3. Continuity hardening:
   - Add canonical continuity guards for infra fallback turns and next-turn edits.
   - Verify session and prompt-origin transitions do not trigger continuity loss.
4. Runtime contract capture:
   - Record profile/flag/control-plane snapshots for local/preview/production.
   - Attach snapshots to phase evidence packets with commit SHA.

## Validation
1. Precheck scope tests:
   - Unsafe latest-user/canonical paths can refuse.
   - Unsafe context/reference fields do not hard-refuse under Phase 2 defaults.
2. Continuity tests:
   - Session switch/reset boundaries.
   - Image-only send behavior.
   - Canonical continuity after infra fallback path.
3. Quality checks:
   - Golden prompt quality suite delta report against baseline.
   - No net increase in false-positive safety refusals on baseline corpus.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`

## Exit Criteria
1. Phase 2 quality and continuity gates are green for OpenAI scope.
2. No net increase in false-positive refusals on the golden corpus.
3. Local/preview/production runtime truth packet is captured and linked in evidence.
4. Tracker rows `P2-01` through `P2-06` have evidence links and pass/fail outcomes recorded.
