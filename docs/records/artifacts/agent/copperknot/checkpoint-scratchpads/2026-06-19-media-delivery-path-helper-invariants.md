# 2026-06-19 Media Delivery Path Helper Invariants

- Lane: P3 `Storage, delivery, and variants`.
- Touched: `frontend/lib/server/api/__tests__/mediaDeliveryPaths.test.ts`.
- Change: added direct invariants for shared media delivery path resolution: image thumb preference, video preview-loop preference, caller-scope rejection, and fail-closed empty results on media row lookup error.
- Validation: `npm -C frontend test -- --run lib/server/api/__tests__/mediaDeliveryPaths.test.ts` passed `4`; touched-file typecheck passed for current P3 files; `npm -C frontend run test:supabase-transform-guard` passed `3`; targeted `git diff --check` passed.
- Boundary: local invariant coverage only; no production/authenticated media delivery proof.
