# Beeper Dual Evaluation Framework

Purpose: define the two linked scoring systems Beeper should use:

- `Agent Evaluation`
- `Product Evaluation`

The goal is to improve both:

- Beeper's performance as a professional alpha tester
- ShortPulse's product quality, trust, and workflow completion

## Why Two Systems Exist

One system is not enough.

If Beeper is scored well but the product findings are weak, the training data is not very valuable.
If the product findings are strong but Beeper's realism or evidence quality is weak, the product score confidence should drop.

These systems must stay separate but linked.

## System 1. Agent Evaluation

This rates how Beeper worked.

Questions it answers:

- Did Beeper choose a high-ROI lane?
- Did Beeper behave like the right tester?
- Did Beeper validate enough workflow depth?
- Did Beeper capture continuity truth?
- Did Beeper preserve useful evidence?
- Did Beeper produce a useful handoff?
- Is Beeper improving over time?

Canonical files:

- `baseline-kpi.md`
- `performance-scorecard.md`
- `performance-ledger.md`
- `campaign-scorecard.md`
- `agent-capability-matrix.md`
- `agent-readiness-ladder.md`
- `trainer-feedback-log.md`
- `mistake-patterns.md`

## System 2. Product Evaluation

This rates how ShortPulse behaved.

Questions it answers:

- Was the route clear?
- Could a user start the workflow easily?
- Could a user finish it?
- Did the product feel trustworthy?
- Did the state survive continuity pressure?
- Did the interface feel polished?
- Did the route fail gracefully?

Canonical files:

- `product-scorecards/product-run-scorecard.md`
- `product-scorecards/route-scoreboard.md`
- `product-scorecards/workflow-scoreboard.md`
- `product-scorecards/trust-break-log.md`
- `product-scorecards/ui-ux-issue-ledger.md`
- `product-scorecards/fix-retest-ledger.md`
- `product-scorecards/positive-pattern-library.md`
- `product-scorecards/quality-ladders.md`

## Shared Run Packet

Each substantive Beeper run should produce one packet that contains:

1. run metadata
2. workflow facts
3. agent evaluation
4. product evaluation
5. evidence links
6. handoff links
7. next agent drill
8. next product priority

Canonical template:

- `reports/shared-evaluation-packet-template.md`

## Linking Rules

### Agent score can reduce product confidence

If Beeper behaves unrealistically, uses weak evidence, or skips continuity checks on a continuity-ready lane, the resulting product score should carry lower confidence.

### Product failure does not automatically mean Beeper failed

If the product genuinely breaks under a believable workflow and Beeper captured it well, that can still be a strong Beeper run.

### Repeated missed issues become agent debt

If Beeper repeatedly overlooks a clear trust-breaking moment, record that in:

- `mistake-patterns.md`
- `trainer-feedback-log.md`

### Repeated product failures become product debt

If the same workflow or route keeps failing, record it in:

- `product-scorecards/fix-retest-ledger.md`
- `product-scorecards/trust-break-log.md`

## Required Per-Run Fields

- date
- environment
- route
- workflow
- interaction fidelity
- what Beeper tried
- what worked
- what failed
- continuity check used
- evidence links
- agent score
- product score
- confidence
- handoffs created
- next agent drill
- next product priority

## Confidence Rule

Every score should carry:

- `high`
- `medium`
- `low`

Weak evidence or unrealistic behavior should lower confidence, not just lower the numeric score.

## Positive Signal Rule

Do not log only failures.

Also preserve:

- what felt unusually clear
- what inspired trust
- what worked smoothly
- what should be preserved as a product quality reference

## Anti-Noise Rule

Do not let the scoring system turn into artifact spam.

Avoid:

- process-only runs that do not move product understanding
- duplicate scoring across multiple files when one authoritative entry is enough
- over-fragmented checkpoints that should have been one route bundle

## Promotion Rule

Use the agent system to decide whether Beeper is ready for harder tasks.

Use the product system to decide which parts of ShortPulse need product attention first.
