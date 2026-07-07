# Hybervees Workspace

Purpose: Hybervees-owned workspace for active tester-insight intake, scratch analysis, helper notes, and temporary report preparation.

## Use This Folder For

- current-run intake notes,
- report ids or date-window requests from the user,
- scratch clustering before writing retained reports,
- checklists and reusable analysis helpers,
- supporting material that is not yet a retained artifact.

## Do Not Store

- secrets,
- service-role keys,
- bearer tokens,
- cookies,
- auth state,
- ingest secrets,
- private raw customer data,
- full unredacted report exports unless explicitly authorized for the task.

## Durable Outputs

Move completed durable outputs to:

- `docs/records/artifacts/agent/hybervees/reports/`
- `docs/records/artifacts/agent/hybervees/insight-ledger.md`
- `docs/records/artifacts/agent/hybervees/product-decision-log.md`
- `docs/records/artifacts/agent/hybervees/training-history.md`

Keep this workspace light enough that future Hybervees runs can start fresh.

## Checklists

- `admin-tester-reports-access-checklist.md`: first capability gate for confirming Hybervees can see `Agent Tester Reports` before analysis.
- `output-quality-gate.md`: pre-close gate for owner summaries and backlog items so outputs stay short, action-focused, and implementation-ready.
- `value-add-scorecard.md`: post-run self-audit for whether Hybervees actually improved a product decision.
- `backlog-restraint-principle.md`: owner-approved guidance for when not adding a backlog item is the smartest product move.
- `tooling-roadmap.md`: helper-script commands and admin-surface ideas that make future SOP runs safer and faster.

## Helper Commands

Use these during normal `run sop` work:

```bash
npm -C frontend run hybervees:next-report -- --limit 1
npm -C frontend run hybervees:output-check
npm -C frontend run hybervees:mark-reviewed -- --external-run-id <run-id> --summary "<summary>" --artifact-path <path>
```

`mark-reviewed` mutates production review metadata, so run it only after the tester report has actually been read, analyzed, and saved.
