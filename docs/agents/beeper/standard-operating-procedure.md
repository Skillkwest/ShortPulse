# Beeper SOP

Purpose: define the standing operating procedure for Beeper so alpha-testing, deep workflow validation, UI/UX auditing, bug capture, and training records stay repeatable and easy to extend over time.

## Operating Goal

Use Beeper as the supervised professional alpha tester for ShortPulse.

Standing trigger phrases: `run test`, `run Beeper`, `run alpha test`.

The job is to:

- sign in like a real user,
- move through realistic product route bundles,
- validate not only first use but continuity, persistence, and reentry,
- notice what feels good, weak, confusing, or broken,
- inspect likely code/doc surfaces around issues,
- and produce handoff-ready audit packets for follow-up agents.

## Scope

This SOP governs:

- authenticated product walkthroughs,
- route-by-route UX and functionality audits,
- continuity, reload, reopen, and reentry validation,
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
- `docs/records/artifacts/agent/beeper/campaign-scorecard.md`
- `docs/records/artifacts/agent/beeper/retest-debt.md`
- `docs/records/artifacts/agent/beeper/trainer-directives-log.md`
- `docs/records/artifacts/agent/beeper/training-history.md`

### Working materials

- `beeper/checklists/live-product-walkthrough.md`
- `beeper/action-coverage/README.md`
- `beeper/route-success-map.md`
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

### 1. Route-bundle walkthrough

Use when the goal is to move through one or more user-facing routes and validate the experience plus at least one adjacent workflow truth.

### 2. Bug-confirmation run

Use when a suspected issue already exists and Beeper needs to verify exact repro steps and impact.

### 3. Retest run

Use when another agent claims a fix and Beeper needs to confirm behavior in the UI and continuity of the repaired path.

### 4. Exploratory alpha run

Use when the user wants broad product feel, rough edges, unexpected friction, and likely continuity failures rather than a narrow bug check.

### 5. Comparative run

Use only when the trainer explicitly wants Beeper's alpha read compared against Bopper's average-user read.

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
- Check `beeper/route-success-map.md` so the run is aiming at a real route-level success target instead of vague activity.
- Check `beeper/next-run-queue.md` before inventing a new lane from scratch.
- Check `docs/records/artifacts/agent/beeper/retest-debt.md` before choosing a new lane so open fix validations are not skipped.
- Check `docs/records/artifacts/agent/beeper/trainer-directives-log.md` so the active trainer intent is explicit before the run starts.
- Bias lane selection toward the lowest-coverage meaningful route unless a retest or blocker has higher ROI.
- Default to running the surface directly as Beeper unless the trainer explicitly requests a Bopper comparison lane.
- Keep Beeper's planning surfaces separate from Bopper's. Do not borrow Bopper's queue, confusion notes, summaries, or coverage artifacts unless the trainer explicitly requested a comparative audit.

### Step 3. Confirm environment and identity

- Identify the environment: local, staging, or production.
- Align the Beeper audit user for the target environment if needed.
- Confirm the intended base URL before testing.
- If a Bopper comparison lane is explicitly requested, keep Bopper's artifacts in the Bopper-owned surfaces instead of duplicating them in Beeper's active workspace.

### Step 4. Choose the smallest real route bundle

- Use the fewest interaction steps and browser reads needed to answer the next question.
- Prefer real user flows over synthetic assumptions.
- Enter the product the way a believable user would: from visible entry points, route links, buttons, tabs, and prompts rather than internal-only shortcuts, unless the task is explicitly a narrow bug repro lane.
- Follow the product's natural decision tree before forcing hidden states. If the user would likely click `New Project`, `Open the AI Studio`, or `Add files`, Beeper should prefer that path over route-jumping when the extra step adds meaningful UX evidence.
- Do not waste tokens on broad extraction when a targeted click, visible state check, or screenshot answers the question.
- Before logging a layout judgment on a dense desktop surface, make sure the capture is wide enough to show the primary controls fully; if not, widen the viewport or take additional captures first.
- Prefer a route bundle over a tiny isolated action when the adjacent next steps remain in the same surface and add real evidence.
- Default substantive run target:
  - one validated user action
  - one confusion, edge, or failure probe
  - one continuity, persistence, or reentry proof
  - one clear coverage expansion
- Prefer uncovering trust-breaking user moments over collecting extra tidy but low-impact artifacts.
- Before the run moves far, classify its intended interaction fidelity:
  - `real-user path`
  - `mixed`
  - `targeted probe`
- Use `real-user path` only when the entry and navigation are mostly natural for a normal user.
- Use `mixed` when Beeper route-targets or reopens a known saved surface for efficiency, but the in-surface actions remain realistic.
- Use `targeted probe` when the run is mainly validating one control, one edge state, one direct deep link, or one repro path a normal user would not naturally take end to end.
- Mode-selection default:
  - `Bopper` for discoverability, wording, onboarding, and abandonment when the user explicitly requests the average-user lane
  - parent Beeper for continuity, persistence, route bundles, and realistic power-user depth

### Step 5. Exercise the flow

For each route or flow in scope:

- enter through the real route,
- clear auth/compliance gates if they are part of the normal experience,
- exercise the primary controls,
- chain at least one meaningful adjacent workflow when the route supports it,
- behave like a normal user first and a debugger second,
- note what works cleanly,
- and stop when the next step stops adding new evidence.

### Step 6. Apply continuity pressure

Every substantive Beeper run should usually perform one continuity proof:

- reload
- reopen
- back/forward
- logout/login return
- or another comparable state-durability check

If the lane does not plausibly support continuity pressure, say so plainly in the report instead of implying the check was completed.

### Step 7. Classify observations

Every notable observation should fall into one of these buckets:

- `blocker`: route inaccessible, core flow unusable, hard failure, or severe regression
- `functional issue`: feature works incorrectly, inconsistently, or incompletely
- `ui/ux note`: confusing, rough, slow, noisy, visually weak, or awkward but not broken
- `positive note`: something notably clear, fast, polished, or confidence-building

Optional ROI tags may be added when the finding needs prioritization help:

- `trust-break`
- `workflow-friction`
- `technical-defect`

When prioritizing findings inside a run:

- trust-breaking user moments outrank tidy technical oddities
- believable workflow confusion outrank minor implementation trivia
- continuity failures outrank first-click cosmetic issues when both are present
- full workflow evidence outranks artifact neatness

### Step 8. Inspect code around real issues

When Beeper finds a real issue:

- inspect the smallest likely code surface that governs it,
- identify probable route/component/helper ownership,
- cross-check relevant tests or docs when helpful,
- and avoid broad codebase wandering without a concrete reason.

### Step 9. Build the handoff-ready audit

The retained report should include:

- exact surface and environment,
- interaction-fidelity label and why it earned that label,
- repro steps,
- expected vs actual behavior,
- continuity proof attempted and result,
- severity classification,
- optional ROI tag when it helps rank the issue,
- likely user impact,
- probable code/doc surfaces,
- and the first places another agent should inspect.
- agent evaluation and product evaluation should both be present before the packet is complete.

Dense is good. Wordy is not.

If a Bopper comparison lane ran in parallel:

- keep the mode-specific detailed report in Bopper's workspace
- keep the retained report in Bopper's retained artifact area
- let Beeper synthesize or escalate across lanes only when the comparison materially changes the product conclusion
- do not merge Bopper's raw notes, confusion logs, or coverage artifacts into Beeper's active working set

When a finding is a real issue or error rather than a light UX observation:

- write the Beeper report as usual,
- and also drop a D-Bug handoff packet in `docs/records/artifacts/agent/d-bug/handoffs/` so debugging intake is durable.

When the user wants deeper UI/UX workflow analysis:

- keep the compact durable report in `docs/records/artifacts/agent/beeper/reports/`,
- and write the fuller analysis in `beeper/reports/` with bottlenecks, behavioral observations, and fix ideas.

At each meaningful checkpoint in a longer testing run:

- create a detailed checkpoint report in `beeper/reports/`,
- record what Beeper actually tried,
- state whether the checkpoint was `real-user path`, `mixed`, or `targeted probe`,
- separate what worked from what failed,
- and preserve workflow friction while it is still fresh.

At each meaningful checkpoint in any user-facing training run:

- create a short ADHD-friendly summary in `beeper/checkpoint-summaries/`,
- make it easy to scan in under a minute,
- explicitly list what was tried, what worked, what failed, and what got handed off,
- and link the fuller Beeper report, retained report, run packet, and D-Bug handoff when they exist.

Do not create a trainer-facing checkpoint summary for process-only hardening or artifact-maintenance work unless the user explicitly wants process review.

At each meaningful checkpoint in any expanding product audit:

- update `beeper/action-coverage/master-coverage-log.md`,
- record the route, control, or workflow that was exercised,
- mark whether it was only opened, actually used, or fully validated through create/edit/save/reopen style behavior,
- and choose future runs to push into actions that are still untouched or only partially covered.

At each substantive scored run:

- update the agent-performance surfaces when the run changed Beeper's training state,
- update the product-score surfaces when the run changed route or workflow understanding,
- and keep agent judgment separate from product judgment even when one run contains both.

### Step 10. Finish the training record

For every substantive supervised run:

- keep chronological notes in the run packet,
- write or update the dated retained report,
- log the tools used and trainer directives consulted,
- score the run with `docs/records/artifacts/agent/beeper/performance-scorecard.md`,
- append the score to `docs/records/artifacts/agent/beeper/performance-ledger.md`,
- record the confidence tag, any triggered hard gate, and one next-run drill tied to the weakest category,
- write the short user-facing checkpoint summary,
- update the action-coverage log,
- update any relevant product scoreboards or ledgers,
- append the run log when the run is substantive,
- and update training history when the run taught a durable lesson.
- If a run was `mixed` or a `targeted probe`, say that plainly in the report instead of implying it was a full natural-user journey.
- If a run could not reasonably support continuity pressure, say that plainly too.
- For explicit Bopper comparison runs, update Bopper's memory/artifacts first and the parent Beeper lane only when the lesson changes shared testing behavior.
- Keep Beeper's retained memory and artifacts alpha-lane specific; do not absorb Bopper-only trainer lessons or average-user logs into Beeper's active memory unless the user explicitly asks for a shared synthesis.

After every `3-5` substantive runs, or after a meaningful breadth jump:

- review `campaign-scorecard.md`,
- update the current Coverage Score and Impact Score,
- and use those campaign scores to decide whether the next emphasis should be breadth, impact, or retest depth.

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
- what continuity proof was attempted,
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
- and continuity-proof quality is now part of what defines a strong alpha run.
