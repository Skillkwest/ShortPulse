# AI Studio Agent Pipeline Regression - Phase 1 OpenAI Execution Plan

Date: 2026-03-20  
Authority: Working  
Owner: AI Platform + Frontend  
Status: Planned (decision complete, implementation pending)

## Summary
This is the decision-complete execution plan for Phase 1 of the agent pipeline remediation program.  
Phase 1 scope is limited to OpenAI agent activity and related client handling.

In-scope endpoints:
1. `/api/ai/studio-agent`
2. `/api/ai/generate-prompt`
3. `/api/ai/describe-image`

Out-of-scope for this phase:
1. All `fal-submit` routes and related generation payload policy wiring.

Program references:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`

## Scope Lock
1. Keep HTTP status behavior unchanged for existing OpenAI routes.
2. Add machine-readable outcome metadata as additive response fields only.
3. Avoid schema migrations in this phase.

## Implementation Decisions
1. Introduce additive response fields for OpenAI agent outputs:
   - `outcome_class`: `success_prompt | refusal_safety | fallback_infra | refusal_model`
   - `reason_code`: `NONE | SAFETY_REFUSAL | INFRA_FALLBACK | MODEL_REFUSAL`
2. Apply this contract consistently in all in-scope OpenAI endpoints.
3. Use one shared server-side mapping helper for fallback/refusal/success classification.
4. Update client agent handling to prefer machine-readable fields when present, while preserving legacy fallback parsing behavior for compatibility.
5. Keep user-facing message copy unchanged in Phase 1 unless required to maintain existing route contract expectations.

## Work Breakdown
1. Baseline and prep:
   - capture at least 3 representative failing trace packets for fallback/refusal ambiguity.
   - freeze relevant runtime safety flag edits during implementation windows.
   - assemble a 15-20 prompt OpenAI-only golden corpus.
2. Server implementation:
   - add shared outcome/reason mapping helper.
   - wire additive fields into `studio-agent`, `generate-prompt`, and `describe-image` responses.
3. Client alignment:
   - update agent response handling to consume `outcome_class` and `reason_code`.
   - preserve existing behavior when additive fields are missing.
4. Documentation and evidence:
   - keep roadmap/tracker and evidence links in sync with this phase plan.
   - store validation packets in `docs/planning/evidence/agent-pipeline-remediation/phase-1/`.

## Validation
1. API tests:
   - assert `outcome_class`/`reason_code` combinations for success, safety refusal, infra fallback, and model refusal paths where applicable.
2. Client tests:
   - verify machine-readable field precedence over legacy message heuristics.
   - verify compatibility when additive fields are absent.
3. Parity checks:
   - run OpenAI route parity matrix on golden corpus and assert classification consistency.
4. Required command bundle:
   - `npm -C frontend run lint`
   - `npm -C frontend run type-check`
   - `npm -C frontend run build`
   - `npm -C frontend run docs:check`

## Exit Criteria
1. OpenAI route parity matrix is green for the in-scope corpus.
2. Baseline failing traces now resolve through expected outcome classification paths.
3. No contract regressions in existing OpenAI route response envelopes beyond additive fields.
