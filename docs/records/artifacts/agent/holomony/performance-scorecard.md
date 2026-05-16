# Holomony Performance Scorecard

Purpose: define a stable scoring system for Holomony's supervised media optimization and performance work so each substantive run can be rated consistently out of 10.

This score measures Holomony's execution quality, not the media panel's raw performance score.

## Scoring Method

Score each category from `0.0` to the category maximum.

Total possible: `10.0`

This is a weighted specialist-behavior score. Strong paperwork cannot compensate for weak evidence or low-ROI lane choices.

## Categories

### 1. Evidence quality (`2.0`)

- `2.0`: conclusions backed by strong live/runtime/test evidence or clearly labeled derived evidence.
- `1.0`: evidence exists but is partial, noisy, or more inferred than ideal.
- `0.0`: weak evidence or overclaiming.

### 2. Scope discipline (`1.5`)

- `1.5`: stayed tightly on the correct media surface and retired dead/adjacent drift quickly.
- `0.75`: mostly correct scope with some mild drift.
- `0.0`: worked the wrong surface or let drift dominate.

### 3. Optimization ROI judgment (`2.0`)

- `2.0`: chose the strongest next step and stopped low-value continuation.
- `1.0`: made some good progress but spent too long in a weaker sub-lane.
- `0.0`: mostly momentum work or low-value adjacency.

### 4. Correctness preservation (`1.5`)

- `1.5`: preserved visible correctness, save/browse trust, and honest reporting while optimizing.
- `0.75`: some correctness awareness, but not tight enough.
- `0.0`: optimization choices put trust or correctness at risk.

### 5. Tooling durability (`1.5`)

- `1.5`: created or improved durable tooling that increases future media-performance leverage.
- `0.75`: tooling work exists but is still awkward, shallow, or under-validated.
- `0.0`: no durable tooling value or tooling that cannot be trusted.

### 6. Retention and training value (`1.0`)

- `1.0`: run produced durable memory, reports, or process changes that will reduce future drift.
- `0.5`: some retained value, but thin or incomplete.
- `0.0`: little durable training value retained.

### 7. Operational discipline (`0.5`)

- `0.5`: followed repo startup rules, environment clarity, and validation discipline cleanly.
- `0.25`: minor process drift.
- `0.0`: material process miss.

## Hard Gates

### Gate 1. No evidence, no strong score

If the run’s main claim is not backed by direct evidence or clearly labeled partial evidence, the total score is capped at `6.9`.

### Gate 2. Wrong-surface cap

If the run continues optimizing a dead or excluded surface after scope was clarified, the total score is capped at `7.0`.

### Gate 3. Overclaim cap

If the run overstates KPI certainty, runtime certainty, or save/browse correctness beyond the evidence, the total score is capped at `6.5`.

### Gate 4. Low-ROI continuation cap

If the run keeps pushing a lane after its ROI is clearly below the best available next step, the total score is capped at `7.6`.

### Gate 5. Correctness-blind optimization cap

If the run makes or recommends speed work that ignores correctness or browse/save trust risk, the total score is capped at `6.5`.

## Confidence Tag

Each scored run should also carry a confidence tag:

- `high`
- `medium`
- `low`

This confidence is about the run assessment, not the panel KPI packet.

## Interpretation

- `9.0 - 10.0`
  - strong specialist run, highly reusable
- `8.0 - 8.9`
  - good run with one meaningful improvement lane
- `7.0 - 7.9`
  - mixed run, useful but inefficient or drift-prone
- `< 7.0`
  - weak run, training correction needed

## Ledger Rule

Each substantive Holomony run should append a row to:

- `docs/records/artifacts/agent/holomony/performance-ledger.md`

Include:

- total score,
- category breakdown,
- confidence,
- hard gate triggered,
- weakest category,
- next improvement.

## Next-Run Drill Rule

Every scored run below `9.0` must record one mechanical next-run drill tied to the weakest category.

Good drills:

- capture two repeated production panel KPI packets before claiming trend improvement
- prove canonical preview coverage with repeat packet history instead of one packet
- remove one dead-surface assumption from the active checkpoint bundle

Bad drills:

- “do better”
- “measure more”
- “optimize harder”
