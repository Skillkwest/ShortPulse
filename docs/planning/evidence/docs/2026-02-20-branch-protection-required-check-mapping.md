# Branch Protection Required-Check Mapping (2026-02-20)

Date: 2026-02-20  
Operator: @sleepyseamonster  
Context: STG-06 manual evidence requirement

## Why manual evidence

Repository rules/protection API access is restricted in this repo context (`403`), so required-check mapping evidence is captured from GitHub UI.

API verification attempt (recorded):
- Command: `gh api repos/sleepyseamonster/ShortPulse/branches/main/protection -H 'Accept: application/vnd.github+json'`
- Result: `403` with message: `Upgrade to GitHub Pro or make this repository public to enable this feature.`
- Date: 2026-02-21

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
- [x] Record operator/date in this file.
- [ ] Record reviewer/date in this file after UI verification.

## Status

Pending manual UI capture and reviewer signoff.
