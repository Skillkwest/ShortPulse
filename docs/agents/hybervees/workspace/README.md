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
