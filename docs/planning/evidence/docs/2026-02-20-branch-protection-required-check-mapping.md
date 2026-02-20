# Branch Protection Required-Check Mapping (2026-02-20)

Date: 2026-02-20  
Operator: @sleepyseamonster  
Context: STG-06 manual evidence requirement

## Why manual evidence

Repository rules/protection API access is restricted in this repo context (`403`), so required-check mapping evidence is captured from GitHub UI.

## Required check names (documented target)

- `frontend`
- `security`
- `deadcode`

Planned required checks after warn/evaluate stabilization:
- `docs_semantic_drift`
- `migration_parity`
- `sql_lint`
- `archive_manifest_check`

## Manual capture checklist

- [ ] Capture repository settings screenshot/export showing required checks.
- [ ] Confirm exact check names match `docs/planning/ci-policy-checks.md`.
- [ ] Record reviewer/date in this file.

## Status

Pending manual UI capture and reviewer signoff.

