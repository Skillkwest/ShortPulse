# Training Data Schema

This schema is intentionally lightweight. The goal is consistency and reuse, not excessive normalization.

## `failure-patterns.jsonl`

One row per recurring failure pattern.

Required fields:

- `pattern_id`
- `name`
- `description`
- `symptoms`
- `misleading_signals`
- `confirming_evidence`
- `standard_next_capture`

Use this dataset for:

- fast pattern matching
- retrieval of known debugging playbooks
- reducing repeated misclassification of incident shape

## `incident-cases.jsonl`

One row per major incident.

Required fields:

- `incident_id`
- `agent`
- `surface`
- `source_surfaces`
- `modes_affected`
- `symptoms`
- `pattern_tags`
- `local_validation_status`
- `production_status`
- `evidence_status`
- `current_best_hypothesis`
- `next_step`
- `source_report`

Use this dataset for:

- case retrieval
- incident clustering
- high-level routing context

## `decision-episodes.jsonl`

One row per major decision pivot.

Required fields:

- `episode_id`
- `incident_id`
- `category`
- `context`
- `observed_evidence`
- `options_considered`
- `chosen_action`
- `reasoning`
- `outcome`
- `lesson`

Suggested `category` values:

- `strategy-pivot`
- `architecture-pivot`
- `validation-pivot`
- `tooling-pivot`

Use this dataset for:

- training debugging judgment
- evaluation cases
- hindsight analysis

## `attempt-ledger.jsonl`

One row per substantive attempted lane.

Required fields:

- `attempt_id`
- `incident_id`
- `hypothesis`
- `intervention`
- `validation`
- `local_result`
- `production_result`
- `verdict`
- `lesson`

Suggested `verdict` values:

- `helpful-but-incomplete`
- `adjacent-fix`
- `likely-correct-but-unverified`
- `disproved`
- `still-open`

Use this dataset for:

- avoiding repeated failed attempts
- tracking what local validation did and did not prove
