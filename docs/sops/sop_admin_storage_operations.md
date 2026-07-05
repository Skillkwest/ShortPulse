# Admin Storage Operations SOP

Purpose: operate `/admin/storage` without confusing product-tracked media usage with Supabase provider billing evidence.

## Scope

Use this SOP when reviewing storage pressure, capturing Supabase usage, or interpreting `/admin/storage`.

This SOP does not authorize production deletes, storage lifecycle cleanup, Stripe billing changes, provider dashboard setting changes, or Supabase image transformations.

## Source Of Truth

- Product-tracked customer media usage: `media_files.file_size`
- Admin storage read route: `frontend/pages/api/admin/storage-economics.ts`
- Provider snapshot write route: `frontend/pages/api/admin/storage-usage-snapshots.ts`
- Provider evidence table: `public.admin_storage_usage_snapshots`
- Snapshot UI: `frontend/features/admin/components/AdminStorageSnapshotCaptureModal.tsx`

Provider snapshots are bill-pressure evidence only. They are not customer entitlement, quota, Stripe, or invoice authority.

## Capturing A Snapshot

1. Open the Supabase production project usage or billing surface for the same period you want to review.
2. Open `/admin/storage`.
3. Click `Capture snapshot`.
4. Enter:
   - snapshot month,
   - capture time,
   - source,
   - Supabase plan and compute context,
   - storage used and included GB,
   - uncached egress used and included GB,
   - cached egress used and included GB,
   - observed overage cents when invoice/export proof exists,
   - short source notes.
5. Save the snapshot and let `/admin/storage` refresh.

## Interpretation Rules

- `Refresh` reloads the ShortPulse admin API; it does not import from Supabase by itself.
- `No snapshot` means no provider usage row is available to the admin API. It does not mean Supabase usage is zero.
- `Stale` means the latest provider snapshot is older than the freshness window used by the admin API.
- Product-tracked bytes and provider usage can differ. Product-tracked bytes come from app rows; provider usage comes from Supabase usage/billing evidence.
- Do not paste raw storage paths, signed URLs, invoice files, customer payment details, service-role keys, or temporary env values into snapshot notes.

## Validation

After changing this workflow, run focused coverage for:

```bash
cd frontend
npm run test -- admin.storage.test.tsx admin-storage-economics.test.ts admin-storage-usage-snapshots.test.ts
```

For route/docs changes, also run:

```bash
npm run docs:check
```

## Stop Conditions

Stop before:

- inserting or editing live production snapshot rows outside the admin UI/API,
- changing Supabase RLS/grants,
- treating estimates as invoice truth,
- adding automated provider imports without a stable provider API/export contract,
- changing customer storage quota behavior,
- or using local/static validation as deployed production proof.
