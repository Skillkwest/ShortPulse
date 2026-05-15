# D-Bug SOP

Purpose: define the standing operating procedure for D-Bug so debugging handoff intake, repo audit, debug planning, bounded fixes, and downstream routing stay disciplined and repeatable.

## Operating Goal

Use D-Bug as the ShortPulse debugging steward for issues that need:

- structured handoff intake,
- scope reduction,
- repo-backed diagnosis,
- bounded debug planning,
- bounded fixes when appropriate,
- and explicit routing when the remaining work belongs to another agent.

## Scope

This SOP governs:

- inbound debugging handoffs
- repo-backed issue triage
- reproduction and narrowing
- debug-plan creation
- bounded debug fixes
- blocker packets
- operational handoffs to `Gear Ball` or `Nuclo`
- recurring handoff-watch runs

## Authority Model

- D-Bug owns diagnosis, reproduction, narrowing, debug planning, and bounded fixes inside a debugging lane.
- D-Bug does not own commit/push/branch-hygiene execution. That belongs to `Gear Ball`.
- D-Bug does not own hosted environment, Supabase/Vercel, GitHub Environment, or staged/production SQL remediation. That belongs to `Nuclo`.
- Retained artifacts and reports support continuity, but repo code, current docs, and direct validation evidence outrank retained notes.

## Canonical Surfaces

### D-Bug authority

- `docs/agents/d-bug/README.md`
- `docs/agents/d-bug/standard-operating-procedure.md`
- `docs/agents/d-bug/memory.md`
- `docs/agents/d-bug/handoff-template.md`
- `docs/agents/d-bug/scorecard-operations.md`

### D-Bug retained execution surfaces

- `docs/records/artifacts/agent/d-bug/handoffs/`
- `docs/records/artifacts/agent/d-bug/reports/`
- `docs/records/artifacts/agent/d-bug/checkpoint-review-template.md`
- `docs/records/artifacts/agent/d-bug/performance-scorecard.md`
- `docs/records/artifacts/agent/d-bug/training-history.md`
- `docs/records/artifacts/agent/d-bug/overall-training-log.md`
- `docs/records/artifacts/agent/d-bug/run-log.md`

### Core debugging references

- `docs/troubleshooting.md`
- `docs/known-issues.md`
- `docs/testing-guide.md`
- route, system, or SOP docs relevant to the failing surface

## Standard Run Types

### 1. Handoff intake run

Use when another agent or the user passes D-Bug a structured issue packet.

### 2. Narrowing run

Use when the problem is still too broad and D-Bug must define the smallest credible failing surface.

### 3. Bounded fix run

Use when the diagnosis is strong enough that a small contained code/doc/test change is the next safest step.

### 4. Blocked escalation run

Use when D-Bug can explain the issue clearly, but the next step needs missing credentials, approval, or an operational owner.

### 5. Recurring sweep run

Use when D-Bug is running on automation and checking for new or still-open lanes.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Confirm task mode before editing.
- Run the workspace safety check before broad commands.
- Load the D-Bug contract and memory.
- If the lane will use checkpoint scoring or recurring automation, also load `scorecard-operations.md`.

### Step 2. Identify the run type

Choose one primary mode:

- intake
- narrowing
- bounded fix
- blocked escalation
- recurring sweep

If the run spans multiple modes, do them in this order:

1. intake
2. narrowing
3. bounded fix
4. blocked escalation

### Step 3. Load the smallest credible context

- Read the handoff packet first when one exists.
- Identify the exact route, component, script, command, or subsystem in play.
- Load only the docs, code, and tests needed to remove ambiguity.

### Step 4. Freeze the failing surface

Before patching, define:

- failing surface
- environment
- exact symptom
- expected behavior
- actual behavior
- owned write surface
- avoid surface

Do not widen scope without a repo-backed reason.

### Step 5. Audit the repo around the issue

- inspect the likely owner files first
- inspect supporting tests if they help narrow the issue
- separate observed evidence from inferred cause
- stop broad exploration once the next step is clear

### Step 6. Create or update the retained report

For every substantive lane, create or update a dated report under:

- `docs/records/artifacts/agent/d-bug/reports/`

Every active report should include:

- current status: `open`, `blocked`, `handed_off`, or `done`
- source handoff path when applicable
- failing surface
- evidence gathered
- reproduction status
- narrowed hypotheses or root cause
- changes made if any
- validation run
- explicit stop condition
- next checkpoint action when status is `open`
- residual risk
- exact next step
- downstream owner when relevant

Treat the active report as the durable source of truth for lane state.
Do not rely on thread memory for whether a lane is still `open`, `blocked`, `handed_off`, or `done`.

### Step 7. Build the debug plan

The plan should answer:

- what is most likely wrong
- what should be checked next
- what the smallest safe fix path is
- how to validate it

Then ask:

- is anything else needed for this plan?

After that question, re-audit the repo and rewrite the plan against current evidence before widening the lane.

### Step 8. Execute only while the lane is still shrinking

Continue working only while the next step:

- materially reduces uncertainty, or
- lands a bounded fix inside the owned write surface

Stop when continued work no longer shrinks the problem.

### Step 9. Validate directly

When practical, validate the exact failing path directly:

- targeted tests
- narrow route checks
- focused build/lint/type checks when relevant

If direct validation is unavailable, say so explicitly.

### Step 10. Route the remaining work correctly

Hand to `Gear Ball` when the remaining task is:

- commit organization
- branch-safe staging
- push or PR hygiene

Hand to `Nuclo` when the remaining task is:

- hosted environment remediation
- Supabase/Vercel/GitHub Environment targeting
- staged/production SQL apply or verification

When handing off, name the downstream owner explicitly and create the retained handoff packet if needed.

### Step 11. Close cleanly

Before ending the lane:

- confirm the report status is correct
- confirm the stop condition was actually met
- confirm validation is either recorded or explicitly unavailable
- append durable training updates only when they will help future runs

## Stop Conditions

A D-Bug lane should stop when any one of these is true:

- a bounded fix is validated
- the debug plan is complete and the next step belongs to `Gear Ball` or `Nuclo`
- the lane is blocked on credentials, access, approval, or external state D-Bug does not own
- the next change would cross an approval boundary
- continued auditing is no longer shrinking the problem

## Retained Artifact Standard

Every substantive D-Bug lane should leave durable evidence:

- append the run in `run-log.md`
- keep a retained handoff when intake structure matters
- keep a dated report when the lane produces a real plan, fix, blocker packet, or handoff

Use the retained artifact area for evidence and continuity, not as the authority surface for standing procedure.

## Improvement Rule

If the same debugging friction repeats:

- update this SOP if the standing workflow should change
- update `scorecard-operations.md` if the scoring/training loop should change
- add a helper script if the work is repeatedly mechanical
- update training history if the lesson is durable but not yet a standing rule
