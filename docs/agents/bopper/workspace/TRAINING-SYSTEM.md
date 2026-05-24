# Bopper Training System

Purpose: define the full document system Bopper must use so every substantive run preserves the same training data.

## Why This Exists

Bopper is not just finding bugs. Bopper is being trained.

That means every real run should leave behind enough data to answer:

- how Bopper chose the lane
- how Bopper tested it
- what Bopper clicked
- why Bopper clicked it as this ICP
- what Bopper expected
- what actually happened
- what business/user conclusion Bopper came to
- whether the UI and UX felt intuitive
- what felt confusing, costly, support-heavy, or abandon-worthy

If that data is not preserved, the run may still be useful in the moment, but it is weak training.

## Primary Uses Of The Data

The run data has two jobs:

1. improve Bopper's fidelity over time as a believable paying ICP so product and design decisions can rely on the pattern
2. teach other agents how to create, refine, and pressure-test new testing personas using evidence instead of vibes

That means the system must preserve both:

- product-facing evidence for real design decisions
- agent-facing evidence for persona-construction lessons

## The Doc Stack

### 1. Always-loaded identity docs

These define who Bopper is before the run starts:

- `docs/agents/bopper/README.md`
- `docs/agents/bopper/memory.md`
- `docs/agents/bopper/standard-operating-procedure.md`
- `docs/agents/bopper/workspace/AGENT-INSTRUCTIONS.md`
- `docs/agents/bopper/workspace/MEMORY.md`
- `docs/agents/bopper/workspace/HANDOFF.md`
- `docs/agents/bopper/workspace/PERSONA.md`
- `docs/records/artifacts/agent/bopper/trainer-directives-log.md`

### 2. Pre-run planning docs

These decide what Bopper should test next and why:

- `docs/agents/bopper/workspace/action-coverage/master-coverage-log.md`
- `docs/agents/bopper/workspace/route-success-map.md`
- `docs/agents/bopper/workspace/next-run-queue.md`
- `docs/records/artifacts/agent/bopper/retest-debt.md`

### 3. Per-run packet docs

These must be created or updated every substantive run:

- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/packet.json`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/run-brief.md`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/notes.md`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/click-log.md`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/decision-log.md`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/evidence/`
- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/evidence/README.md`

### 4. Run output docs

These summarize the run for human review and future reuse:

- `docs/agents/bopper/workspace/reports/YYYY-MM-DD-<env>-<slug>.md`
- `docs/agents/bopper/workspace/checkpoint-summaries/YYYY-MM-DD-<env>-<slug>-summary.md`
- `docs/records/artifacts/agent/bopper/reports/YYYY-MM-DD-<env>-<slug>.md`
- `docs/records/artifacts/agent/d-bug/handoffs/YYYY-MM-DD-<slug>.md` when a real engineering issue is found

### 5. Durable rollup docs

These accumulate training knowledge across runs:

- `docs/agents/bopper/workspace/first-click-map.md`
- `docs/agents/bopper/workspace/confusion-patterns.md`
- `docs/agents/bopper/workspace/abandon-points.md`
- `docs/agents/bopper/workspace/ignored-controls-log.md`
- `docs/agents/bopper/workspace/terminology-misread-log.md`
- `docs/records/artifacts/agent/bopper/run-log.md`
- `docs/records/artifacts/agent/bopper/performance-ledger.md`
- `docs/records/artifacts/agent/bopper/training-history.md`
- `docs/records/artifacts/agent/bopper/persona-design-lessons.md`
- `docs/records/artifacts/agent/bopper/campaign-scorecard.md`

## What Each Run Must Capture

### `run-brief.md`

This is the pre-run plan and hypothesis file.

It must answer:

- Why this lane was chosen now
- Which ICP pressure points matter most here
- What Bopper expects to happen
- What would count as a win, confusion point, or abandonment point
- What Bopper should avoid doing because it would be too smart or too synthetic

### `packet.json`

This is the structured run manifest.

It should preserve:

- slug, date, environment, and base URL
- the run folder and report-shell paths
- where the evidence folder lives
- a stable machine-readable record another agent can parse later

### `notes.md`

This is the chronological scratch log.

It must answer:

- What happened in order
- When confusion appeared
- When Bopper changed his mind
- What runtime or evidence was captured

### `click-log.md`

This is the most important training artifact for user-behavior learning.

Every meaningful click or input should capture:

- where Bopper was
- what he clicked
- why he clicked it
- what he expected
- what actually happened
- whether the choice felt intuitive in hindsight

### `decision-log.md`

This is the ICP judgment file.

It must capture what Bopper concluded as a paying Studio user:

- Is this intuitive?
- Do I know what to do next?
- Would I need admin help here?
- Does this feel risky from a credit perspective?
- Does this feel worth what I pay?
- Is this too much work for the expected business payoff?
- Would I keep going or abandon the flow?

### `docs/agents/bopper/workspace/reports/...`

This is the detailed workflow report.

It should synthesize the click log, decision log, findings, and code-follow-up surfaces.
This is part of the real operator record and should preserve the technical detail needed to make product changes.

### `docs/agents/bopper/workspace/checkpoint-summaries/...`

This is the short ADHD-friendly digest.

It should summarize the full run packet, detailed report, and retained report in a format that is easy to scan quickly.
It should use real Markdown headings so the trainer can visually parse it fast instead of reading a plain bullet slab.
It is not the operator record.

It should always preserve:

- a top-line result sentence
- what he tried
- what worked
- what broke or confused him
- one short take on trust / keep-going / ICP reaction
- what got handed off
- a quoted customer-reaction line
- and first-person full thought sentences so the trainer hears the run in Bopper's voice

Default body shape:

- `Bottom Line`
- `What I Tried`
- `What Worked`
- `What Broke`
- `My Take`

Footer lines only:

- `Handoff: ...`
- `Read next: ...`

It should avoid carrying the heavier operator details that belong in the technical record.

### `docs/records/artifacts/agent/bopper/reports/...`

This is the retained audit record.

It should be the compact, durable version another agent can use later without replaying the whole run.
This is part of the real operator record and should keep the technical detail needed for follow-up work.

### `docs/records/artifacts/agent/bopper/persona-design-lessons.md`

This is the cross-agent teaching file.

It should preserve:

- which persona assumptions were confirmed by real behavior
- which persona assumptions were wrong or incomplete
- which pressure points proved predictive
- which fields future personas should always define up front
- which mistakes make a persona feel synthetic instead of useful

## Required Questions Every Run Must Answer

Every substantive run should preserve explicit answers to these questions:

1. Why did Bopper enter this route?
2. Why did Bopper click that control instead of another visible control?
3. What did Bopper think would happen next?
4. What actually happened?
5. Did the product feel intuitive at that step?
6. What was Bopper struggling with?
7. Did Bopper feel at risk of wasting credits?
8. Did Bopper feel he needed admin help?
9. Did the workflow feel like too much work for the expected payoff?
10. Would Bopper keep going, retry once, change routes, or abandon?
11. Did the run confirm, weaken, or refine the persona itself?
12. Did the run teach anything reusable about how future testing personas should be built?

## Operator Record Rule

The real technical/operator record lives in:

- `docs/agents/bopper/workspace/runs/<timestamp>-<slug>/`
- `docs/agents/bopper/workspace/reports/...`
- `docs/records/artifacts/agent/bopper/reports/...`

Those surfaces should preserve the detail needed to make real changes, including:

- route and environment specifics
- interaction-fidelity notes
- click-by-click rationale
- runtime and evidence references
- exact failure states
- code/doc follow-up surfaces
- probable ownership or first inspection points
- retest-debt implications

The checkpoint summary should not try to replace that layer.

## Minimum Update Rule

For every substantive run, Bopper must update at least:

- one per-run packet
- one detailed report
- one checkpoint summary
- one retained report
- one run-log entry
- one performance-ledger entry
- one training-history entry when the run taught something durable
- one persona-design-lessons update when the run taught something reusable about the ICP shape or persona-construction method
- the relevant coverage / confusion / abandonment / retest docs

## Best-Practice Update Order

1. Create run packet
2. Execute route bundle
3. Fill notes, click log, and decision log while the run is fresh
4. Write detailed report
5. Write checkpoint summary
6. Write retained report
7. Write D-Bug handoff if needed
8. Update durable rollup docs
9. Append score, training history, and persona-design lessons when warranted

## Quality Bar

A run is under-documented if it only says:

- what broke
- and not why Bopper made the choices he made

A strong training run preserves both:

- user behavior
- user judgment
- persona-learning value

That is the difference between bug notes and persona training.
