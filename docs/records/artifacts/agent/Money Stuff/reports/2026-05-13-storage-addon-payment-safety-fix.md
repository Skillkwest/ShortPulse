# 2026-05-13: Storage Add-On Payment Safety Fix

## Report Metadata

- Date: 2026-05-13
- Lane: storage add-ons
- Requested trigger phrase: `continue with your next steps`
- Operator intent: continue Money Stuff training on recurring storage/media add-ons after the credit-package history fix

## Starting State

- Public truth state: profile storage add-on cards and storage payment history were already live and test-covered.
- Sellable catalog state: recurring storage add-on catalog rows were driven by `billing_storage_addons` and `billing_storage_addon_offers`.
- Billing/runtime state: `/api/billing/storage-addon/change` directly mutated Stripe subscription items and relied on webhook sync to project final local state.
- Support/admin state: storage drift diagnostics already existed, but the self-serve mutation route still had unresolved fail-open risk.

## Actions Taken

1. Audited the storage add-on mutation route, storage invoice history path, webhook projection logic, and profile storage surface.
2. Found and fixed two money-impacting add-flow risks in `/api/billing/storage-addon/change`:
   - add-on purchases now send `payment_behavior=error_if_incomplete` so the route fails closed instead of claiming success when Stripe leaves the subscription update incomplete/past_due
   - add-on purchases now also check live Stripe subscription items before posting, preventing duplicate recurring add-on charges when local webhook sync is stale
3. Added focused regression coverage in `frontend/tests/api/storage-addon-change.test.ts` and reran the adjacent storage/profile tests.

## Validation

- Commands run:
  - `npx vitest run tests/api/storage-addon-change.test.ts tests/api/subscription-transactions.test.ts tests/pages/profile.storage-actions.test.tsx`
  - `git diff --check -- 'frontend/pages/api/billing/storage-addon/change.ts' 'frontend/tests/api/storage-addon-change.test.ts'`
- Tests passed:
  - `tests/api/storage-addon-change.test.ts`
  - `tests/api/subscription-transactions.test.ts`
  - `tests/pages/profile.storage-actions.test.tsx`
- Live/manual checks:
  - none in this pass
- Gaps or blockers:
  - the existing `profile.storage-actions` suite still emits known React `act(...)` warnings during polling-based refresh tests

## Outcome

- Public truth result: unchanged
- Sellable catalog result: unchanged
- Billing/runtime result:
  - storage add-on purchases fail closed when immediate payment cannot complete
  - storage add-on purchases no longer trust stale local rows alone when deciding whether an add-on is already active
- Support/admin result: unchanged
- Docs/index updates:
  - retained report added under Money Stuff artifacts

## Lessons Learned

- Durable lesson(s):
  - direct recurring upsell routes must not report success while Stripe is still in an incomplete payment state
  - when local entitlement rows are webhook-projected, duplicate protection for self-serve add flows must check live Stripe subscription items, not only local mirrored rows
- Tooling gap(s):
  - the storage action lane still has no real Stripe test-mode walkthrough locked into Money Stuff history
- SOP/doc updates needed:
  - none required for this patch

## Follow-Ups

- Immediate next step:
  - run a real Stripe test-mode storage add-on change and top-up walkthrough if approval is available
- Deferred validation:
  - confirm the fail-closed add-on message is acceptable in a real incomplete-payment scenario
- Remaining risk:
  - storage payment history titles still depend on current catalog display names rather than immutable local snapshots if Stripe line descriptions are not used
