# Hybervees Scripts

Purpose: small helper scripts for Hybervees Admin Tester Reports intake, review marking, and output quality checks.

Run from the repo root, or use the `frontend/package.json` aliases.

## Commands

```bash
npm -C frontend run hybervees:next-report -- --limit 1
npm -C frontend run hybervees:mark-reviewed -- --external-run-id <run-id> --summary "<summary>" --artifact-path <path>
npm -C frontend run hybervees:output-check
```

## Safety

- Scripts load canonical local env files without printing secret values.
- `mark-reviewed` updates only Hybervees-owned review and insight metadata.
- `next-report` prints metadata, artifact paths, and evidence keys by default, not raw report bodies.
- `output-check` verifies owner-summary format and optional backlog/mirror quality gates.
