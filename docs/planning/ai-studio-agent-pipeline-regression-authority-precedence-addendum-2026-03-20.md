# AI Studio Agent Prompt-Compiler Authority And Precedence Addendum

Date: 2026-03-20  
Authority: Working  
Owner: Engineering + Platform Ops

## Purpose
Resolve governance overlap between active agent plans and define deterministic precedence for remediation-scope decisions.

## Scope
Applies to:
1. `docs/planning/ai-studio-agent-pipeline-regression-remediation-roadmap-2026-03-20.md`
2. `docs/planning/ai-studio-agent-pipeline-regression-remediation-tracker-2026-03-20.md`
3. `docs/planning/ai-studio-agent-modularization-program.md`
4. `docs/planning/ai-studio-agent-modularization-tracker.md`
5. `docs/planning/ai-studio-agent-safety-control-plane-plan.md`
6. `docs/planning/ai-studio-agent-safety-control-plane-tracker.md`
7. `docs/planning/ai-studio-agent-pipeline-hardening-plan.md`

## Precedence Order (Highest To Lowest)
1. Active incident command decisions and emergency rollback directives.
2. Remediation master roadmap/tracker decision locks and gates for OpenAI remediation scope.
3. Safety control-plane hard-floor and policy-plane constraints.
4. Modularization guardrails and structural CI/governance constraints.
5. Historical pipeline hardening plan content where not superseded.

## Conflict Resolution Rules
1. If remediation execution conflicts with modularization scheduling, remediation behavior gates win; modularization sequencing is rescheduled.
2. If remediation execution conflicts with safety hard floors, safety hard floors win.
3. If two active docs disagree on threshold or gate semantics, remediation threshold contract is authoritative for remediation scope.
4. Any override requires explicit amendment record in remediation tracker operational notes.

## Operational Boundary
1. This remediation program governs behavior, rollout gating, and closeout packets for OpenAI remediation endpoints.
2. Safety control-plane docs govern profile persistence, policy activation/rollback mechanics, and immutable safety floors.
3. Modularization docs govern module topology, size/boundary guardrails, and deprecation architecture.

## Supersession Notes
1. `ai-studio-agent-pipeline-hardening-plan.md` is treated as historical baseline context for this remediation stream.
2. No historical plan is deleted or invalidated; precedence is scoped by this addendum.

