# Copperknot Report - 2026-05-16 - production-repo-audit-and-dispatch-output

Purpose: run the Copperknot SOP against the current `production` repo snapshot, refresh the current production-readiness window to the new `2026-07-02` target, and produce a dispatch-ready ordered worklist.

## Audit Target

- Branch: `production`
- Audit snapshot date: `2026-05-16`
- Commit anchor: `e410d71917186243d482d21dc34fbbab1ab03d27`
- Evidence model:
  - current `production` repo truth
  - current worktree state at audit start
  - retained production reports already present in the repo
- Constraint:
  - no external closeout reports currently exist under `docs/records/artifacts/agent/copperknot/reports/external-lane-closeouts/`, so this run reconstructs current truth directly from repo state and retained reports

## Inputs Reviewed

- Catalog authority:
  - `docs/systems/catalog.md`
  - `docs/systems/ship-readiness-scoreboard.md`
  - `docs/systems/rating-rubric.md`
- Copperknot authority:
  - `docs/agents/copperknot/README.md`
  - `docs/agents/copperknot/standard-operating-procedure.md`
  - `docs/agents/copperknot/operating-package-2026-05-06.md`
  - `docs/agents/copperknot/prioritized-handoff-queue-2026-07-02.md`
  - `docs/agents/copperknot/dispatch-ready-audit-output-template.md`
- Retained reports:
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-15-production-launch-state-refresh.md`
  - `docs/records/artifacts/agent/copperknot/reports/2026-05-06-dispatch-log.md`
  - `docs/records/artifacts/agent/beeper/reports/2026-05-15-prod-character-reuse-lane.md`
  - `docs/records/artifacts/agent/holomony/reports/2026-05-15-production-panel-baseline-capture.md`
- Low-weight local evidence reviewed but not promoted to production truth:
  - `docs/records/artifacts/agent/bopper/reports/2026-05-16-local-open-projects-reopen-vs-new-project.md`
- Sampled repo-change evidence:
  - `git log` through `e410d71917186243d482d21dc34fbbab1ab03d27`
  - `git show --stat 6d545c5da846a0e15c18c8bb8223a30709508180`
  - `git show --stat d8eb70d50d935fe3099fa8386001e20f7c8f866c`
  - current worktree diffs in:
    - AI Studio generation-controller and credit-guardrail seams
    - media-panel data-controller and attachment-preview seams
    - admin Pulse built-in control-plane seams

## Audit Decisions

### 1. Active target window moved to `2026-07-02`

- Reason:
  - the user explicitly moved the projected ship date
  - the active queue and plan should use the new target instead of forcing `2026-06-06` legacy files to keep carrying current authority
- Effect:
  - new active queue and plan files were created for the `2026-07-02` window

### 2. The queue must stay actionable, not historical

- Reason:
  - `Generation recovery / settlement` is execution-complete and reviewed
  - keeping it as queue priority `1` weakens the queue as an exact next-work surface
- Effect:
  - the reviewed-complete lane stays tracked, but it is removed from the exact next-work order

### 3. `Reference Grid` remains the active ship-path blocker

- Reason:
  - the active blocker still lacks a closeout report
  - no stronger production evidence has landed to clear or reroute it
- Effect:
  - it stays active, but it is not duplicated in the dispatch-ready next-work output below

### 4. `Project / workspace persistence` has stronger repo evidence, but not enough new production proof to move ahead of the next runtime lanes

- Reason:
  - recent production commits hardened media autosave and persistence
  - the strongest contradiction report remains local-only
  - the newest local Bopper reopen-vs-new-project artifact is still only a template shell, not a completed evidence packet
- Effect:
  - the lane stays packaged and important, but remains held behind the newly packaged runtime and security lanes

### 5. `Characters workflow` now has fresh production trust-break evidence

- Reason:
  - Beeper recorded a real edit -> reload -> auth bounce on `/character`
  - the route also still lacks clear save confidence
- Effect:
  - no score change yet
  - the row and handoff should now treat the lane as concrete production follow-up, not only generic low-confidence cleanup

### 6. Queue-only ship-critical rows needed real handoff packets

- Reason:
  - `Billing / credits`, `Security boundaries`, and `Generation submission / polling` were still below floor but not yet dispatchable
- Effect:
  - new handoff packets were created so the queue can now produce real external prompts instead of abstract rows

## Score Decisions

- No score changes in this pass.
- Why:
  - this run was a repo audit and dispatch-prep pass
  - current evidence was strong enough to move execution packaging and queue order
  - current evidence was not strong enough to justify upward rerating without lane closeouts or broader validation

## Queue Outcome

The current exact next-work order for undispatched lanes is now:

1. `Edit workflow`
2. `Billing / credits`
3. `Security boundaries`
4. `Generation submission / polling`
5. `Project / workspace persistence`
6. `Characters workflow`

`Reference Grid` remains the active blocker already in flight.

## Dispatch-Ready Output

### Priority 1: `Edit workflow`

- Current score: `5/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Why now:
  - this is the next undispatched P0 workflow lane after the active Reference Grid blocker
- Key blocker or risk:
  - large stateful surface across layers, markup, inpaint, flatten/export, and submit/runtime coupling
- Recommended agent profile:
  - AI Studio workflow modularization
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md`

### Paste-Ready Prompt

```text
You are taking over lane `edit-workflow-hardening` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-06-edit-workflow.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

### Priority 2: `Billing / credits`

- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Why now:
  - this is a below-floor P0 runtime authority and it was previously not dispatchable
- Key blocker or risk:
  - reservation, settlement, snapshot, and Stripe grant paths can still drift apart
- Recommended agent profile:
  - billing runtime + reconciliation
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md`

### Paste-Ready Prompt

```text
You are taking over lane `billing-credits-runtime-hardening` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-16-billing-credits-runtime-hardening.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

### Priority 3: `Security boundaries`

- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Why now:
  - this is a below-floor P0 release-safety boundary and it was previously not dispatchable
- Key blocker or risk:
  - protected-route, RLS/storage, and runtime SQL posture can drift independently
- Recommended agent profile:
  - security boundary + route/RLS audit
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md`

### Paste-Ready Prompt

```text
You are taking over lane `security-boundaries-release-audit` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-16-security-boundaries-release-audit.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

### Priority 4: `Generation submission / polling`

- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Why now:
  - recovery improved, but the shared accepted-job ingress is still below floor
- Key blocker or risk:
  - submit invariants, optimistic lifecycle state, and polling convergence still share one hot path
- Recommended agent profile:
  - provider submit/status contracts
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md`

### Paste-Ready Prompt

```text
You are taking over lane `generation-submission-polling-hardening` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-16-generation-submission-polling-hardening.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

### Priority 5: `Project / workspace persistence`

- Current score: `6/10`
- Target score: `7/10`
- Ship floor: `7/10`
- Why now:
  - the system remains below floor, but recent production commits made it less urgent than the newly packaged runtime/safety lanes
- Key blocker or risk:
  - restore authority and project-scoped workspace continuity still need sharper proof
- Recommended agent profile:
  - persistence contracts + restore boundaries
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md`

### Paste-Ready Prompt

```text
You are taking over lane `project-workspace-persistence-hardening` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-06-project-workspace-persistence.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```

### Priority 6: `Characters workflow`

- Current score: `5/10`
- Target score: `6/10`
- Ship floor: `6/10`
- Why now:
  - fresh production evidence converted this from a generic low-confidence row into a concrete trust-break follow-up
- Key blocker or risk:
  - edit -> reload continuity currently bounces through auth and save confidence is still weak
- Recommended agent profile:
  - workflow modularization + persistence cleanup
- Handoff path:
  - `docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md`

### Paste-Ready Prompt

```text
You are taking over lane `characters-workflow-hardening` for the ShortPulse repo.

Use this handoff as the scope authority:
docs/agents/copperknot/handoffs/2026-05-06-characters-workflow.md

Execution rules:
- stay inside the owned write surface
- do not expand into adjacent systems unless the stop rules explicitly allow it
- run the validation required by the handoff
- create the required closeout report in the Copperknot intake folder before treating the lane as finished

Return one of:
- bounded patch complete
- findings packet complete
- blocked with evidence
```
