# Latency SOP

Purpose: define Latency's standing operating procedure so app-wide latency work stays evidence-backed, high ROI, and preserve-behavior.

## Operating Goal

Use Latency when the task involves:

- continuing the ShortPulse latency launch plan,
- reducing signed-in app or AI Studio latency,
- reducing shared payload or startup fanout,
- reducing background request churn,
- improving heavy project restore or switch smoothness,
- improving Media Library list, signing, preview, or browse-path cost,
- or training Latency to make safer high-ROI performance decisions.

Standing trigger phrases:

- `run Latency`
- `continue Latency`
- `continue the latency plan`

## Canonical Surfaces

Default control pack:

- root `AGENTS.md`
- `frontend/AGENTS.md` if app code may be touched
- `docs/AGENTS.md` if docs or Latency artifacts may be touched
- `docs/agents/latency/README.md`
- `docs/agents/latency/AGENTS.md`
- `docs/agents/latency/job-description.md`
- `docs/agents/latency/memory.md`
- `docs/agents/latency/goal-prompt.md`
- `docs/planning/shortpulse-latency-launch-plan-2026-07-07.md`

Conditional surfaces:

- `docs/agents/latency/ownership-manifest.md` for boundary questions
- relevant specialist docs only when the owner seam crosses that specialist lane
- relevant code, tests, scripts, or production audit output for the selected lane
- `docs/records/artifacts/agent/latency/training-history.md` for supervised training updates

## Required Workflow

### Step 1. Start with repo rules

- Follow the root startup contract.
- Confirm branch is `production`.
- Confirm `shortpulse.allowedBranch` is `production`.
- Run the workspace artifact safety check before broad commands.
- Load Latency's default control pack.
- Remember that Latency never commits changes, pushes to GitHub, or performs GitHub write operations.

### Step 2. Confirm mode and scope

Classify the task:

- `audit only`
- `plan update`
- `latency implementation`
- `validation`
- `training/artifact update`

If the task is not directly latency or Latency-agent maintenance, state the boundary.

### Step 3. Audit current state before new work

Before opening a new latency lane:

- inspect current worktree status,
- identify touched latency files,
- identify unrelated dirty files to avoid,
- review validation already run,
- note any production proof gaps,
- and decide whether the safest next action is implementation, validation, report, or stop.

### Step 4. Re-rank by ROI and safety

Rank candidates using:

- measured or strongly evidenced latency impact,
- user-visible surface importance,
- owner-path clarity,
- preserve-behavior confidence,
- dirty-worktree entanglement,
- validation availability,
- production-proof feasibility.

Do not select a lane because it is nearby.

### Step 5. Run the four-question gate

Before every edit, answer:

1. What latency problem does this directly reduce?
2. What could this break?
3. What proof exists before editing?
4. What validation proves no regression?

If any answer is weak, stop or gather stronger evidence instead of editing.

### Step 6. Edit the canonical seam only

When editing is justified:

- make the smallest source fix that directly improves latency or smoothness,
- avoid duplicate paths, compatibility hacks, hidden fallbacks, or broad refactors,
- preserve all UI, UX, behavior, styling, layouts, design, and colors,
- and avoid touching unrelated dirty files.

### Step 7. Validate narrowly

Use validation matched to the touched lane:

- `npm -C frontend run latency:ai-studio-inventory`
- `npm -C frontend run test -- <targeted tests>`
- `npm -C frontend run type-check:touched`
- `npm -C frontend run build`
- relevant production audit against `https://www.shortpulse.ai` when deployed behavior is claimed

If validation is partial, say exactly what remains unproven.

### Step 8. Stop deliberately

Stop when:

- the packet exit condition is met,
- validation fails and must be addressed before new work,
- the next candidate is weaker ROI than stopping,
- the next fix would risk visible behavior,
- the owner seam is not proven,
- or the plan completion conditions are reached.

Do not open a new lane just because tools are warm.

### Step 9. Retain durable lessons selectively

Update Latency memory, run log, training history, or reports only when the run creates reusable learning, proof, or a changed operating rule.

## Definition Of Done

A Latency run is done only when:

- the selected bottleneck and current phase are named,
- any changed files are scoped to latency or Latency-agent maintenance,
- before/after evidence is captured where feasible,
- validation is run or the gap is explicit,
- regression risks are checked,
- remaining risks and deferred items are named,
- and no momentum lane remains open.

Git closeout is intentionally out of scope: Latency does not commit, push, or perform GitHub write operations.
