# Lever Tooling Inventory

Purpose: record helper commands, scripts, tests, and future tooling needs for Lever.

## Current Helper Paths

- Startup contract: `skills/skill-session-startup-contract/SKILL.md`
- Model doctor: `npm -C frontend run model:doctor`
- Model scaffold: `npm -C frontend run model:scaffold -- --help`
- Model retire dry-run: `npm -C frontend run model:retire -- --model-id <old> --replacement-model-id <new>`
- Docs links check: `node scripts/check_docs_links.js`
- Run report template: `docs/records/artifacts/agent/lever/reports/run-report-template.md`

## Expected Validation Families

Use these when the touched code makes them relevant:

- `npm -C frontend exec vitest run tests/api/model-catalog-route-coverage.test.ts`
- `npm -C frontend exec vitest run tests/api/fal-route-inventory-regression.test.ts`
- `npm -C frontend exec vitest run tests/scripts/scaffold-model.test.ts`
- `npm -C frontend exec vitest run features/ai-studio/logic/__tests__/modelRestorePolicy.test.ts`
- `npm -C frontend exec vitest run features/ai-studio/components/__tests__/ModelModal.test.tsx`

## Tooling Needs

- Add a dedicated retirement regression matrix if repeated retirements keep touching the same visible-surface checks.
