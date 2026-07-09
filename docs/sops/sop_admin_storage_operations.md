# Admin Storage Operations SOP

Purpose: document the parked admin storage workspace and the boundaries for any future
reactivation lane.

## Current Status

`/admin/storage` is currently deactivated.

- The Storage tab is removed from the shared admin navigation.
- `/admin/storage` returns 404 and does not mount the storage dashboard.
- `/api/admin/storage-economics` returns `410 Gone` before admin auth, Supabase reads,
  storage metadata scans, billing reads, lifecycle RPC calls, or provider snapshot reads.
- `/api/admin/storage-usage-snapshots` returns `410 Gone` before admin auth,
  validation, Supabase writes, or `admin_storage_usage_snapshots` inserts.
- Existing storage economics components, types, helpers, and API implementation code are
  parked in source for a future reactivation lane.

## Parked Architecture

Do not delete or repurpose these files without a dedicated reactivation or removal plan:

- `frontend/pages/admin/storage.tsx`
- `frontend/pages/api/admin/storage-economics.ts`
- `frontend/pages/api/admin/storage-usage-snapshots.ts`
- `frontend/features/admin/components/AdminStorageEconomicsPanel.tsx`
- `frontend/features/admin/components/AdminStorageSnapshotCaptureModal.tsx`
- `frontend/features/admin/logic/useAdminStorageEconomicsController.ts`
- `frontend/features/admin/logic/adminStorageEconomicsApi.ts`
- `frontend/lib/server/api/adminStorageProviderUsage.ts`
- `frontend/lib/server/api/adminStorageIntelligence.ts`

## Reactivation Boundaries

A future reactivation lane must explicitly decide whether `/admin/storage` should again
make product, marketing, or sales decisions from storage evidence. Before reactivation,
audit source freshness for:

- Product-tracked customer media usage: `media_files.file_size`
- Provider storage bytes: Supabase `storage.objects.metadata.size`
- Provider egress/included-quota/observed-overage evidence:
  `public.admin_storage_usage_snapshots`
- Account health: billing contracts/profile plan state, active storage add-ons, plan
  catalog rows, and `media_files.file_size`
- Lifecycle health: aggregate `get_media_storage_lifecycle_summary` rows only
- Storage add-on funnel: sanitized `telemetry.storage.addon` rows in `app_error_events`

Automatic and manual provider snapshots remain bill-pressure evidence only. They are
not customer entitlement, quota, Stripe, cleanup, or invoice authority.

## Validation

After changing the parked/deactivated storage workflow, run focused coverage for:

```bash
cd frontend
npm run test -- admin.storage.test.tsx admin-storage-economics.test.ts admin-storage-usage-snapshots.test.ts AdminPageHeader.test.tsx admin.stats.test.tsx
```

For route/docs changes, also run:

```bash
npm run docs:check
```

## Stop Conditions

Stop before:

- reactivating `/admin/storage` without a dedicated plan,
- inserting or editing live production snapshot rows,
- changing Supabase RLS/grants,
- treating estimates as invoice truth,
- adding automated provider imports,
- changing customer storage quota behavior,
- or using local/static validation as deployed production proof.
