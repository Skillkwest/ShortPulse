# Lever Run Report: Seedance 1.5 Residue Audit

## Report Metadata

- Date: 2026-05-13
- Run type: retire / residue audit
- Model(s): `kie-ai/seedance-1.5-pro`
- Requested trigger phrase: `i dont think seedance 1.5 is fully gone`
- Operator intent: verify whether the retired model still appears active and remove the remaining misleading app/doc residue

## Starting State

- Relevant catalog/runtime state:
  - `kie-ai/seedance-1.5-pro` was already deprecated with `replacementModelId` pointing to `kie-ai/seedance-2`.
- Relevant app-visible state:
  - the compatibility-only advanced settings panel still rendered the title `Seedance 1.5 Settings` when the deprecated id was active in compatibility scenarios.
- Relevant docs/SOP/tooling state:
  - top-level docs still described Seedance 1.5 as an active AI Studio video lane in `README.md` and `docs/routes.md`
  - supporting SOP/API docs still carried active wording

## Actions Taken

1. Audited repo references for `Seedance 1.5` across app code, docs, and model-platform tooling.
2. Renamed the compatibility-only video settings title to `Legacy Seedance Compatibility Settings`.
3. Removed active wording from top-level product/runtime docs and clarified that Seedance 1.5 is compatibility-only.

## Validation

- Commands run:
  - `cd frontend && npm exec vitest run features/ai-studio/components/__tests__/VideoPropertiesPanel.test.tsx features/ai-studio/components/__tests__/ReferenceSeedanceAdvancedSteps.test.tsx features/ai-studio/hooks/__tests__/useAiStudioViewModel.test.ts`
  - `node scripts/check_docs_links.js`
- Tests passed:
  - `3/3` focused test files passed
  - `59/59` focused tests passed
  - documentation checks passed
- Gaps or blockers:
  - compatibility/runtime references still remain intentionally in catalog, route inventory, provider contracts, and compatibility tests until hard removal is requested

## Outcome

- Final lifecycle state:
  - unchanged; still deprecated with replacement to `kie-ai/seedance-2`
- Final route-authority state:
  - unchanged; compatibility routes remain intentionally retained
- Final visible app state:
  - deprecated settings label no longer markets `Seedance 1.5` as an active app-facing setting
- Docs/index updates:
  - top-level docs and supporting SOP/API docs now describe the lane as deprecated compatibility-only instead of active

## Lessons Learned

- Durable lesson(s):
  - a retirement can be technically correct in the catalog while still leaking active wording through docs or compatibility-only UI labels
- Tooling gap(s):
  - the current retirement workflow would benefit from a stronger docs/app-surface residue checklist for “active wording” drift
- SOP/doc updates needed:
  - current Lever SOP was sufficient for this run; no new SOP file was required

## Follow-Ups

- Compatibility-window cleanup:
  - keep compatibility/runtime references until hard removal is explicitly requested
- Hard-removal readiness:
  - a later hard-removal phase should delete the deprecated route inventory entry, runtime contract references, pricing strategy residue, and legacy API docs
- Future model-maintenance improvements:
  - add a targeted residue audit checklist for retired picker-visible models if this pattern repeats
