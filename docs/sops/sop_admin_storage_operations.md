# Admin Storage Operations SOP

Purpose: operate `/admin/storage` as a decision-support surface without confusing product-tracked media usage, account health, lifecycle aggregate diagnostics, or Supabase provider billing evidence.

## Scope

Use this SOP when reviewing storage pressure or interpreting `/admin/storage`.

This SOP does not authorize production deletes, storage lifecycle cleanup, Stripe billing changes, provider dashboard setting changes, or Supabase image transformations.

## Source Of Truth

- Product-tracked customer media usage: `media_files.file_size`
- Admin storage read route: `frontend/pages/api/admin/storage-economics.ts`
- Automatic production snapshot source: Supabase `storage.objects.metadata` through the service-role admin client when readable.
- Product-tracked fallback source: `media_files.file_size`.
- Provider egress/included-quota/observed-overage evidence: latest aggregate row from `public.admin_storage_usage_snapshots` when present.
- Account health: derived from active billing contracts/profile plan state, active storage add-ons, plan catalog rows, and `media_files.file_size`.
- Lifecycle health: aggregate `get_media_storage_lifecycle_summary` rows only; no raw paths or cleanup authority are exposed to the browser payload.
- Source-confidence boundaries: `/api/admin/storage-economics` evidence rows that identify what each metric can and cannot prove.
- Trend status: currently a readiness field until durable historical storage snapshots exist.
- Legacy/manual provider snapshot write route: `frontend/pages/api/admin/storage-usage-snapshots.ts`
- Legacy/manual provider evidence table: `public.admin_storage_usage_snapshots`

Automatic and manual provider snapshots are bill-pressure evidence only. They are not customer entitlement, quota, Stripe, or invoice authority.

## Automatic Snapshot Behavior

1. Open `/admin/storage`.
2. The page loads `/api/admin/storage-economics`.
3. The API attempts to sum production Supabase `storage.objects.metadata.size`.
4. If that storage schema read is unavailable, the API falls back to production `media_files.file_size`.
5. When a provider snapshot row exists, the API keeps live storage bytes but uses that snapshot for egress, included quota, compute context, and observed overage evidence.
6. The API adds top-storage, quota-pressure, and add-on-opportunity account rows from the same billing/storage aggregates used by the existing route.
7. The API calls the service-role-only lifecycle summary RPC and returns aggregate object classes. If the RPC is unavailable, the page shows an unavailable lifecycle state instead of inventing cleanup data.
8. `Refresh` reruns the live admin API read. No manual entry is required for storage bytes; egress remains only as fresh as the latest provider snapshot or configured environment values.

## Interpretation Rules

- `Refresh` reloads the ShortPulse admin API and rebuilds the automatic production snapshot.
- `No snapshot` means the automatic production snapshot could not be built. It does not mean Supabase usage is zero.
- `Stale` means the latest provider snapshot is older than the freshness window used by the admin API.
- Product-tracked bytes and provider usage can differ. Product-tracked bytes come from app rows; automatic provider storage comes from Supabase storage metadata when readable.
- Egress is not derived from `storage.objects`; treat egress cards as provider-snapshot evidence when present and configured estimate evidence otherwise.
- Account-health rows are decision-support rows for product, marketing, sales, and support review. They do not change entitlements, storage limits, billing state, or customer-facing quota behavior.
- Lifecycle-health rows are aggregate report-only diagnostics. They can support product and operations decisions, but they do not authorize cleanup, deletion, or object-level investigation from this page.
- Source-confidence rows are part of the page contract. If a decision depends on an unavailable or stale source, refresh or collect the correct upstream evidence before acting.
- Trend cards must remain explicit about unavailable history until a durable historical snapshot source is added.
- The business and funnel panels are admin decision support only. They do not change customer entitlements, Stripe state, or storage quota enforcement.
- Do not paste raw storage paths, signed URLs, invoice files, customer payment details, service-role keys, or temporary env values into snapshot notes.

## Validation

After changing this workflow, run focused coverage for:

```bash
cd frontend
npm run test -- admin.storage.test.tsx admin-storage-economics.test.ts admin-storage-usage-snapshots.test.ts internal-media-storage-lifecycle-run.test.ts
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
