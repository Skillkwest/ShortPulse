# SOP: Model API Contract Re-Verification

Purpose: keep `frontend/lib/model-runtime/modelCatalog.ts` source provenance and `verifiedAt` metadata current for active provider models without relying on memory or ad hoc spot checks.

## Scope

Use this SOP when:

- a provider model contract changes
- a queued/direct model is added or materially updated
- a monthly contract hygiene pass is due
- `scripts/check_model_catalog_parity.js` or `npm -C frontend run docs:check` reports stale `verifiedAt` data

This SOP does not replace route- or payload-specific regression tests. It is the operator workflow for verifying external provider contract provenance and refreshing catalog timestamps/source links.

## Source of Truth

- Catalog metadata: `frontend/lib/model-runtime/modelCatalog.ts`
- Parity/staleness gate: `scripts/check_model_catalog_parity.js`
- New model onboarding workflow: `docs/sops/sop_new_model_ingestion.md`

## Trigger Conditions

Run this workflow when any of the following is true:

1. Monthly cadence check for active provider-backed models
2. A provider/model contract changed
3. A new model was added
4. `check_model_catalog_parity.js` reports stale verification dates
5. A route/payload bug suggests docs or model defaults may have drifted

## Workflow

1. Identify the target models.
   - For monthly hygiene, review all active provider-backed runtime models.
   - For scoped changes, review only the touched model family plus any paired edit/create lanes.

2. Re-open the canonical provider reference for each target model.
   - Use the `sourceUrl` from `modelCatalog.ts`.
   - Confirm the URL still points to the correct provider-owned contract page.

3. Re-verify the fields ShortPulse actually depends on.
   - submit/status endpoint shape
   - auth model
   - required/optional payload fields
   - default aspect/size or duration/resolution behavior
   - output/result shape needed by the app
   - any provider-specific constraints that affect payload validation or UI clamps

4. Update `modelCatalog.ts` if needed.
   - refresh `sourceUrl` if the provider moved the canonical contract page
   - update `verifiedAt` to the current verification date
   - update catalog defaults or payload contract metadata if the provider contract changed

5. Update API docs when ShortPulse-facing behavior changed.
   - relevant files under `docs/api/`
   - keep docs aligned with the current app contract, not raw provider copy alone

6. Run the parity gate.
   - `cd frontend && node ../scripts/check_model_catalog_parity.js`

7. Run broader docs validation if docs changed.
   - `cd frontend && npm run docs:check`

## Validation

Minimum validation:

- `cd frontend && node ../scripts/check_model_catalog_parity.js`

Use when docs changed:

- `cd frontend && npm run docs:check`

Use targeted runtime/API tests when the provider contract update changed behavior:

- route-specific `vitest` lane
- payload-matrix or model-route coverage tests as appropriate

## Notes

- `check_model_catalog_parity.js` already enforces valid `sourceUrl` hosts and a maximum `verifiedAt` age window.
- Refreshing `verifiedAt` without actually re-checking the provider contract defeats the purpose of the gate.
- If a provider contract changed in a way that would alter app behavior, open a dedicated runtime lane instead of hiding it inside a metadata-only refresh.
