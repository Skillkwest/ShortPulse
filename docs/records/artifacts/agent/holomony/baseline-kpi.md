# Holomony Baseline KPI

Purpose: freeze the initial measurable baseline for Holomony's media optimization and performance workflow so future runs can be compared against a stable point in time.

## Status

- Baseline date: `2026-05-15`
- Status: `Provisional baseline`
- Maturity at freeze: `Level 1: Supervised`

Why provisional:

- Holomony has completed one substantial setup-and-retrospective cycle, but not yet five repeated substantive optimization runs.
- The KPI framework and capture workflow are now strong enough to measure future work honestly.
- This baseline is good enough to start trend tracking, but should be re-frozen after a fuller run history exists.

## Scope Measured

This baseline measures Holomony as a specialist, not the media panel itself.

It evaluates whether Holomony:

- frames the right media-performance problem,
- chooses high-ROI work,
- preserves correctness while optimizing,
- builds durable measurement/tooling,
- retains useful training artifacts,
- and avoids repeated workflow mistakes.

## Fixed Categories

Total possible: `10.0`

### 1. Evidence quality (`2.0`)

Measures whether claims are backed by real audits, packet data, runtime evidence, or clearly labeled inference.

### 2. Scope discipline (`1.5`)

Measures whether Holomony stayed on the user-approved media surface and retired adjacent/dead surfaces quickly.

### 3. Optimization ROI judgment (`2.0`)

Measures whether the chosen next step had a better payoff than stopping or continuing a lower-value lane.

### 4. Correctness preservation (`1.5`)

Measures whether optimization work preserved visible correctness, save/browse trust, and honest reporting.

### 5. Tooling durability (`1.5`)

Measures whether Holomony creates or improves measurement, capture, KPI, and retained audit tools that can be reused.

### 6. Retention and training value (`1.0`)

Measures whether the run produced durable memory, reports, templates, or process improvements that reduce future drift.

### 7. Operational discipline (`0.5`)

Measures startup-contract compliance, branch/env clarity, validation discipline, and clean stop/go decisions.

## Hard Failure Conditions

Any of these conditions override raw score:

- claimed performance success without evidence
- optimized the wrong or dead surface after scope was clarified
- introduced correctness or save-trust risk without explicit approval
- skipped meaningful validation and still claimed closeout
- allowed malformed or weak-evidence KPI packets to overclaim

## Initial Baseline Snapshot

### Current baseline score

- Overall baseline: `8.3 / 10`
- Confidence: `medium`
- Read: good supervised operator with clear evidence discipline, but still building repetition and long-run consistency

### Baseline breakdown

- Evidence quality: `1.8 / 2.0`
- Scope discipline: `1.1 / 1.5`
- Optimization ROI judgment: `1.6 / 2.0`
- Correctness preservation: `1.4 / 1.5`
- Tooling durability: `1.3 / 1.5`
- Retention and training value: `0.8 / 1.0`
- Operational discipline: `0.3 / 0.5`

### Why this baseline is not higher

- some lane drift happened before the surface was narrowed correctly
- environment language blurred branch vs runtime/database context at points
- KPI scoring matured before capture ergonomics did
- live telemetry access was not consistently strong enough early on

## Evidence Anchors

Use these retained artifacts as the baseline evidence set:

- Holomony lane retrospective:
  - `docs/records/artifacts/agent/holomony/reports/archive/2026-05-15-media-panel-optimization-retrospective.md`
- Holomony KPI tooling:
  - `frontend/scripts/media_panel_kpi_score.mjs`
  - `frontend/scripts/media_panel_kpi_capture.mjs`
- KPI SOP:
  - `docs/sops/sop_media_panel_performance_kpi.md`
- Current Holomony memory and training history:
  - `docs/agents/holomony/memory.md`
  - `docs/records/artifacts/agent/holomony/training-history.md`

## Pass Thresholds

- `9.0+`
  - strong specialist performance
- `8.0 - 8.9`
  - useful and improving, with one or two material weak spots
- `7.0 - 7.9`
  - mixed value; real progress but too much drift or avoidable friction
- `< 7.0`
  - weak run; training correction needed before scale

## Degradation Warning Threshold

If Holomony’s rolling average across the latest `5` substantive runs falls below `7.8`, treat that as meaningful performance drift.

## Comparison Rule

Do not rewrite this baseline to make future work look better.

Instead:

1. score future runs with `performance-scorecard.md`,
2. log them in `performance-ledger.md`,
3. compare trends against this baseline,
4. create a new dated baseline only when the workflow changes materially.
