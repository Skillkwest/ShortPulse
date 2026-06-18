# Product Image Asset Route Canonicalization - 2026-06-17

Purpose: compact Copperknot scratchpad for the product-image asset route cleanup. This is not a source of truth; use the code, route docs, launch board, and queue as authority.

## Touched

- Deleted stale multipart route `frontend/pages/api/media/admit-image-asset.ts`.
- Deleted stale route test `frontend/tests/api/media-admit-image-asset-route.test.ts`.
- Removed multipart/parser-only residue from `frontend/lib/server/productImageAssetAdmission.ts`.
- Kept the canonical product-image routes:
  - `/api/media/prepare-product-image-asset-upload`
  - `/api/media/finalize-product-image-asset-upload`
  - `/api/media/admit-image-asset-from-storage`
- Updated active route docs and Gutan memory so agents do not resurrect `/api/media/admit-image-asset`.
- Updated Copperknot queue, board, and scorecard with local-only proof.

## Validation

- `npm -C frontend run test -- --run lib/server/__tests__/productImageAssetAdmission.test.ts tests/api/media-product-image-asset-routes.test.ts tests/api/protected-api-paths.parity.test.ts` passed at `3` files / `7` tests.
- `npm -C frontend run type-check:touched` passed.
- `npm -C frontend run docs:check` passed before the launch-control doc update; rerun after this scratchpad before closeout.
- `git diff --check` passed before the launch-control doc update; rerun after this scratchpad before closeout.
- `npm -C frontend run build` passed; the build route table no longer lists `/api/media/admit-image-asset`.

## Proof Boundary

This is local route-retirement and source-hardening proof only. It does not prove deployed absence of `/api/media/admit-image-asset`, authenticated Character/Elements save/reopen behavior, or broader Creative Libraries launch readiness.
