# Admin Storage Operations SOP

Purpose: operate `/admin/storage` without confusing product-tracked media usage with Supabase provider billing evidence.

## Scope

Use this SOP when reviewing storage pressure or interpreting `/admin/storage`.

This SOP does not authorize production deletes, storage lifecycle cleanup, Stripe billing changes, provider dashboard setting changes, or Supabase image transformations.

## Source Of Truth

- Product-tracked customer media usage: `media_files.file_size`
- Admin storage read route: `frontend/pages/api/admin/storage-economics.ts`
- Automatic production snapshot source: Supabase `storage.objects.metadata` through the service-role admin client when readable.
- Product-tracked fallback source: `media_files.file_size`.
- Legacy/manual provider snapshot write route: `frontend/pages/api/admin/storage-usage-snapshots.ts`
- Legacy/manual provider evidence table: `public.admin_storage_usage_snapshots`

Automatic and manual provider snapshots are bill-pressure evidence only. They are not customer entitlement, quota, Stripe, or invoice authority.

## Automatic Snapshot Behavior

1. Open `/admin/storage`.
2. The page loads `/api/admin/storage-economics`.
3. The API attempts to sum production Supabase `storage.objects.metadata.size`.
4. If that storage schema read is unavailable, the API falls back to production `media_files.file_size`.
5. `Refresh` reruns the live admin API read. No manual entry is required.

## Interpretation Rules

- `Refresh` reloads the ShortPulse admin API and rebuilds the automatic production snapshot.
- `No snapshot` means the automatic production snapshot could not be built. It does not mean Supabase usage is zero.
- `Stale` means the latest provider snapshot is older than the freshness window used by the admin API.
- Product-tracked bytes and provider usage can differ. Product-tracked bytes come from app rows; automatic provider storage comes from Supabase storage metadata when readable.
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
