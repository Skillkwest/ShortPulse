# Beeper SOP

Purpose: define the standing operating procedure for Beeper so live product testing, UI/UX auditing, bug capture, and training records stay repeatable and easy to extend over time.

## Operating Goal

Use Beeper as the supervised live-product tester for ShortPulse.

Standing trigger phrase: `run test`.

The job is to:

- sign in like a real user,
- move through real product flows,
- notice what feels good, weak, confusing, or broken,
- inspect likely code/doc surfaces around issues,
- and produce handoff-ready audit packets for follow-up agents.

## Scope

This SOP governs:

- authenticated product walkthroughs,
- route-by-route UX and functionality audits,
- issue reproduction and severity classification,
- code-surface inspection around observed issues,
- handoff packet creation,
- and supervised training recordkeeping.

## Canonical Surfaces

### Beeper authority

- `docs/agents/beeper/README.md`
- `docs/agents/beeper/memory.md`
- `docs/records/artifacts/agent/beeper/baseline-kpi.md`
- `docs/records/artifacts/agent/beeper/performance-scorecard.md`
- `docs/records/artifacts/agent/beeper/performance-ledger.md`
- `docs/records/artifacts/agent/beeper/trainer-directives-log.md`
- `docs/records/artifacts/agent/beeper/training-history.md`

### Working materials

- `beeper/checklists/live-product-walkthrough.md`
- `beeper/action-coverage/README.md`
- `beeper/next-run-queue.md`
- `beeper/checkpoint-summaries/README.md`
- `beeper/reports/README.md`
- `beeper/runs/README.md`
- `beeper/templates/action-coverage-update-template.md`
- `beeper/templates/training-run-notes-template.md`
- `beeper/templates/checkpoint-user-summary-template.md`
- `docs/records/artifacts/agent/beeper/reports/run-report-template.md`
- `beeper/templates/workflow-ux-audit-template.md`

### Core product references

- `README.md`
- `docs/routes.md`
- `docs/testing-guide.md`
- `docs/troubleshooting.md`
- `docs/local-development.md`

### Current helper scripts

- `node beeper/scripts/start-training-run.mjs --slug <name>`
- `node beeper/scripts/start-checkpoint-report.mjs --slug <name>`
- `node beeper/scripts/ensure-audit-user.mjs --apply`
- `node beeper/scripts/ensure-audit-user.mjs --environment production --apply`
- `node beeper/scripts/live-product-walkthrough.mjs`

## Standard Run Types

### 1. Walkthrough run

Use when the goal is to move through one or more user-facing routes and evaluate the experience.

### 2. Bug-confirmation run

Use when a suspected issue already exists and Beeper needs to verify exact repro steps and impact.

### 3. Retest run

Use when another agent claims a fix and Beeper needs to confirm behavior in the UI.

### 4. Exploratory run

Use when the user wants broad product feel, rough edges, and unexpected friction rather than a narrow bug check.

## Required Workflow

### Step 1. Start with repo rules

- Follow the root `AGENTS.md` startup contract.
- Load Beeper contract and memory.
- Load route/testing docs relevant to the target surface.

### Step 2. Start the training packet

- Create a dated packet before substantive supervised work:
  - `node beeper/scripts/start-training-run.mjs --slug <name>`
- Use the packet for chronological notes and raw evidence.
- Use the retained report for the durable audit summary.
- Check `beeper/action-coverage/master-coverage-log.md` before picking the next lane so the run expands coverage on purpose.
- Check `beeper/next-run-queue.md` before inventing a new lane from scratch.
- Check `docs/records/artifacts/agent/beeper/trainer-directives-log.md` so the active trainer intent is explicit before the run starts.

### Step 3. Confirm environment and identity

- Identify the environment: local, staging, or production.
- Align the Beeper audit user for the target environment if needed.
- Confirm the intended base URL before testing.

### Step 4. Choose the smallest real path

- Use the fewest interaction steps and browser reads needed to answer the next question.
- Prefer real user flows over synthetic assumptions.
- Enter the product the way a believable user would: from visible entry points, route links, buttons, tabs, and prompts rather than internal-only shortcuts, unless the task is explicitly a narrow bug repro lane.
- Follow the product's natural decision tree before forcing hidden states. If the user would likely click `New Project`, `Open the AI Studio`, or `Add files`, Beeper should prefer that path over route-jumping when the extra step adds meaningful UX evidence.
- Do not waste tokens on broad extraction when a targeted click, visible state check, or screenshot answers the question.
- Before logging a layout judgment on a dense desktop surface, make sure the capture is wide enough to show the primary controls fully; if not, widen the viewport or take additional captures first.

### Step 5. Exercise the flow

For each route or flow in scope:

- enter through the real route,
- clear auth/compliance gates if they are part of the normal experience,
- exercise the primary controls,
- behave like a normal user first and a debugger second,
- note what works cleanly,
- and stop when the next step stops adding new evidence.

### Step 6. Classify observations

Every notable observation should fall into one of these buckets:

- `blocker`: route inaccessible, core flow unusable, hard failure, or severe regression
- `functional issue`: feature works incorrectly, inconsistently, or incompletely
- `ui/ux note`: confusing, rough, slow, noisy, visually weak, or awkward but not broken
- `positive note`: something notably clear, fast, polished, or confidence-building

### Step 7. Inspect code around real issues

When Beeper finds a real issue:

- inspect the smallest likely code surface that governs it,
- identify probable route/component/helper ownership,
- cross-check relevant tests or docs when helpful,
- and avoid broad codebase wandering without a concrete reason.

### Step 8. Build the handoff-ready audit

The retained report should include:

- exact surface and environment,
- repro steps,
- expected vs actual behavior,
- severity classification,
- likely user impact,
- probable code/doc surfaces,
- and the first places another agent should inspect.

Dense is good. Wordy is not.

When a finding is a real issue or error rather than a light UX observation:

- write the Beeper report as usual,
- and also drop a D-Bug handoff packet in `docs/records/artifacts/agent/d-bug/handoffs/` so debugging intake is durable.

When the user wants deeper UI/UX workflow analysis:

- keep the compact durable report in `docs/records/artifacts/agent/beeper/reports/`,
- and write the fuller analysis in `beeper/reports/` with bottlenecks, behavioral observations, and fix ideas.

At each meaningful checkpoint in a longer testing run:

- create a detailed checkpoint report in `beeper/reports/`,
- record what Beeper actually tried,
- separate what worked from what failed,
- and preserve workflow friction while it is still fresh.

At each meaningful checkpoint in any user-facing training run:

- create a short ADHD-friendly summary in `beeper/checkpoint-summaries/`,
- make it easy to scan in under a minute,
- explicitly list what was tried, what worked, what failed, and what got handed off,
- and link the fuller Beeper report, retained report, run packet, and D-Bug handoff when they exist.

At each meaningful checkpoint in any expanding product audit:

- update `beeper/action-coverage/master-coverage-log.md`,
- record the route, control, or workflow that was exercised,
- mark whether it was only opened, actually used, or fully validated through create/edit/save style behavior,
- and choose future runs to push into actions that are still untouched or only partially covered.

### Step 9. Finish the training record

For every substantive supervised run:

- keep chronological notes in the run packet,
- write or update the dated retained report,
- log the tools used and trainer directives consulted,
- score the run with `docs/records/artifacts/agent/beeper/performance-scorecard.md`,
- append the score to `docs/records/artifacts/agent/beeper/performance-ledger.md`,
- record the confidence tag, any triggered hard gate, and one next-run drill tied to the weakest category,
- write the short user-facing checkpoint summary,
- update the action-coverage log,
- append the run log when the run is substantive,
- and update training history when the run taught a durable lesson.

## Severity Framework

### Blocker

- Prevents meaningful use of the route or core task.
- Example: sign-in fails, route hard-crashes, required modal cannot close, primary creation flow cannot proceed.

### Functional Issue

- Feature is reachable but incorrect.
- Example: wrong state, broken save, dead button, inconsistent modal behavior, missing persistence, misleading success path.

### UI / UX Note

- Product is usable, but confidence or clarity is weak.
- Example: awkward copy, poor affordance, noisy layout, hidden action, unclear hierarchy, excessive friction.

### Positive Note

- Something should be preserved or used as a quality reference.
- Example: especially clear dashboard summary, fast route load, strong modal feedback, polished visual rhythm.

## Handoff Standard

A Beeper handoff should tell the next agent:

- what route or flow was tested,
- how to reproduce the issue,
- how severe it is,
- what evidence exists,
- which files/docs likely matter first,
- and what still remains unknown.

If code was inspected, include file paths. If not, say that clearly.
Use `docs/agents/d-bug/handoff-template.md` as the default intake shape when the target is D-Bug.

## Training Standard

Beeper is in training mode. That means:

- every substantive supervised run gets logged,
- every substantive supervised run should log tools, directives, and a score,
- every substantive supervised run should also update the performance ledger,
- every score below `9/10` should produce one concrete process improvement,
- every substantive supervised run should end with one next-run drill tied to the weakest category,
- deeper workflow coverage should win over additional process hardening unless process drift is the real blocker,
- and repeated friction should become a helper, checklist rule, or SOP update.

## Known Scenario Framework

The following scenarios are already known and should expand over time:

### Scenario A. Auth and access gates

- sign-in
- route protection
- media compliance gate
- profile/account access

### Scenario B. Route walkthroughs

- dashboard
- AI Studio
- media library
- character
- profile

### Scenario C. Issue-to-code handoff

- reproduce
- classify
- inspect likely code surfaces
- produce handoff packet

### Scenario D. Retest after fixes

- verify claimed fix
- check for regressions nearby
- update report with pass/fail and residual risk

## Improvement Rule

When Beeper encounters a new repeated situation, add it to one of these places:

- this SOP if it changes the standing workflow,
- the checklist if it changes run order,
- the helper scripts if it should be mechanized,
- or training history if it is still a lesson rather than a rule.
