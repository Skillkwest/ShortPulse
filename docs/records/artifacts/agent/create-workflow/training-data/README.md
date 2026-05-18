# Create Workflow Training Data

Purpose: convert Create Workflow conversation history, incident audits, and debugging decisions into structured training data that is easier to reuse than raw transcripts.

## Why this exists

Raw conversation history is too verbose and too repetitive to function as high-quality training input by itself.

This folder extracts the highest-signal supervision units:

- incident cases
- decision episodes
- attempt ledgers

These are intended to teach:

- better debugging strategy
- better architecture decisions
- better stopping rules when production contradicts local confidence

## Files

- `schema.md`
  - field definitions and intended use for each dataset
- `incident-cases.jsonl`
  - one row per major Create Workflow incident
- `decision-episodes.jsonl`
  - one row per important strategy or architecture pivot
- `attempt-ledger.jsonl`
  - one row per meaningful attempted lane, fix, or audit pass
- `failure-patterns.jsonl`
  - one row per recurring incident pattern and its recommended next capture

## Operator Tools

The repo now includes a small CLI around this dataset:

- summary:

```bash
cd frontend
npm run create-workflow:training:summary
```

- validation:

```bash
cd frontend
npm run create-workflow:training:validate
```

- incident brief:

```bash
cd frontend
npm run create-workflow:training:brief
```

- capture ingest:

```bash
cd frontend
npm run create-workflow:capture:ingest -- /path/to/snapshot.json --incident-id create-workflow-2026-05-composer-attachment-001 --label prod-repro
```

Underlying script:

- `frontend/scripts/create_workflow_training_data.mjs`

## Data discipline

- Prefer short, explicit fields over narrative paragraphs.
- Record what was known at the time, not only hindsight conclusions.
- Keep raw chat out of this folder unless it is transformed into labeled structure.
- Use paths to authoritative reports instead of duplicating long prose.

## Recommended use

1. Read the latest incident report.
2. Append or revise structured rows here.
3. Use this dataset to derive:
   - retrieval context
   - decision-playbook examples
   - evaluation cases
   - future agent training prompts
4. Use `failure-patterns.jsonl` to classify new incidents before deciding whether a new fix is actually novel.
