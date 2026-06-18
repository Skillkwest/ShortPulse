# 2026-06-17 Generation Abandon Reconcile Auth Boundary

- Selected lane: Recovery, settlement, and output integrity / customer-facing generation recovery support.
- Source changes: added route-owned unexpected auth failure logging to `frontend/pages/api/generation/abandon.ts` and `frontend/pages/api/generation/reconcile.ts`.
- Test changes: added abandon auth-boundary coverage and new `frontend/tests/api/generation-reconcile.route.test.ts` covering auth failure, invalid input, identity reconcile, and project reconcile dispatch.
- Validation: focused route slice passed `11` tests; related generation abandon/reconcile slice passed `26` tests; `type-check:touched`, `docs:check`, and scoped `git diff --check` passed before this scratchpad.
- Caveat: Vitest emitted the existing macOS canvas/sharp duplicate `GNotificationCenterDelegate` warning during route tests; tests passed and no patch-specific failure appeared.
- Proof boundary: local source/testing only. No production generation, credit spend, recovery mutation, commit, push, or deploy was performed.
