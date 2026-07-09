# Admin Storage Intelligence Buildout Plan - 2026-07-09

## Objective

Turn `/admin/storage` into a readable, decision-grade storage intelligence and
account-health admin tool. The page should support product, marketing, and sales
decisions by showing storage health, account risk, add-on MRR, provider pressure,
egress and overage snapshots, lifecycle health, and clear evidence boundaries.

## Owner And Lane

- Owner/lane: Admin storage / storage economics.
- Working branch: `production`.
- Current implementation surface: `/admin/storage` and `/api/admin/storage-economics`.

## Source Of Truth

- Product-tracked customer media usage: `media_files.file_size`.
- Provider storage bytes: Supabase `storage.objects.metadata.size` when readable
  through the service-role admin client.
- Provider egress, included quota, compute context, and observed overage evidence:
  latest aggregate row from `public.admin_storage_usage_snapshots`.
- Add-on MRR and sold capacity: `billing_subscription_storage_addons`,
  `billing_storage_addons`, `billing_storage_addon_offers`, current billing
  contract/profile state, and plan catalog rows.
- Storage add-on funnel: sanitized `telemetry.storage.addon` rows in
  `app_error_events`.
- Lifecycle health: service-role-only aggregate `get_media_storage_lifecycle_summary`
  and the ADR 0098 manifest-first/delete-last contract.
- Admin route/UI sources:
  - `frontend/pages/admin/storage.tsx`
  - `frontend/pages/api/admin/storage-economics.ts`
  - `frontend/features/admin/components/AdminStorageEconomicsPanel.tsx`
  - `frontend/features/admin/logic/useAdminStorageEconomicsController.ts`
  - `frontend/features/admin/logic/adminStorageEconomicsApi.ts`
  - `frontend/features/admin/types.ts`

## Approved Scope

1. Preserve the existing `/api/admin/storage-economics` route while extending its
   response with source/confidence, account intelligence, lifecycle health, and
   trend-ready fields.
2. Refactor oversized storage server/UI seams when necessary to keep one clear
   responsibility per file.
3. Rework `/admin/storage` into a simple, readable decision dashboard:
   - Executive snapshot
   - Provider pressure
   - Account health
   - Lifecycle health
   - Add-on revenue and conversion
   - Evidence boundaries
4. Use aggregate lifecycle diagnostics only. Do not expose raw object paths,
   signed URLs, user-private storage paths, secrets, payment details, invoice
   files, or service-role data in browser payloads.
5. Update focused tests and docs for the changed route/UI contract.

## Non-Goals

- No Stripe mutation or live Stripe proof.
- No customer quota semantics changes.
- No storage cleanup, deletion, or cleanup authorization.
- No Supabase RLS/grant changes unless separately approved.
- No provider import automation, live snapshot row insertion, deploy, commit, or
  push in this lane.
- No duplicate admin storage authority or parallel replacement route.

## Implementation Sequence

1. Establish the durable plan source and update indexes.
2. Add typed source/confidence and storage-intelligence fields to the admin
   storage API contract and normalizer defaults.
3. Split server builders from the route as needed, keeping the route thin.
4. Add account-intelligence rows for top storage accounts, quota pressure, and
   storage add-on opportunity.
5. Add aggregate lifecycle-health rows by reusing the service-role-only
   lifecycle summary source.
6. Rework the admin storage panel into decision-focused section components.
7. Update docs/SOP/routes/readme text to describe the expanded decision-support
   surface and boundaries.
8. Run focused validation and self-audit for drift, oversized files, and
   security/data-exposure regressions.

## Proof Requirements

Run focused validation before closeout:

```bash
cd frontend
npm run test -- admin.storage.test.tsx admin-storage-economics.test.ts admin-storage-usage-snapshots.test.ts internal-media-storage-lifecycle-run.test.ts
npm run type-check:touched
npm run docs:check
git diff --check
```

If a command is blocked by pre-existing unrelated repository state, preserve the
exact error and separate it from this lane's regression signal.

## Stop Conditions

Stop when `/admin/storage` renders the new decision sections from canonical
aggregate sources, focused validation is complete or clearly blocked, docs are
updated, and no customer quota, billing, provider import, production deployment,
or cleanup behavior has changed.

Stop immediately before:

- live production snapshot insertion,
- scheduled provider import,
- hosted SQL apply,
- deploy,
- commit,
- push,
- storage cleanup or deletion,
- customer quota behavior changes,
- Stripe/billing mutation,
- or any change requiring another owner/lane.
