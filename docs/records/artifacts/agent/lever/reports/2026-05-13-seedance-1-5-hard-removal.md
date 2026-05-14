# Lever Run Report: Seedance 1.5 Hard Removal

- Date: 2026-05-13
- Run type: hard removal
- Model(s): `kie-ai/seedance-1.5-pro`
- Operator intent: fully remove Seedance 1.5 support because it is no longer needed at all

## Starting State

- `kie-ai/seedance-1.5-pro` had already been retired to `kie-ai/seedance-2`.
- Compatibility runtime, route, pricing, provider-contract, and test surfaces were still present.
- Active app-facing residue had already been cleaned in a prior residue-audit run.

## Work Completed

1. Removed active model inventory support from the runtime/catalog/pricing layer.
2. Removed the Kie Seedance 1.5 submit/status compatibility route surface.
3. Removed 1.5-specific provider normalizers, adapter metadata, and route-contract assumptions.
4. Removed or updated focused tests so the active Kie video lane is now Seedance 2.
5. Deleted obsolete API docs for Seedance 1.5.
6. Re-ran a residue scan and confirmed the remaining references are historical only.

## Validation

- Focused video/runtime/provider tests
- `node scripts/model_doctor.js`
- `node scripts/check_docs_links.js`
- `npm -C frontend run fal:routes:check`

## Final State

- `Seedance 1.5 Pro` is gone from active app/runtime/route/pricing/doc support.
- The only remaining references are intentional historical records:
  - change log
  - planning snapshot
  - Lever memory, run log, training history, and prior residue-audit report

## Lessons

- Full removal should follow retirement only after compatibility support is explicitly no longer required.
- Lever should preserve historical training records by default while removing all active product/runtime support.
