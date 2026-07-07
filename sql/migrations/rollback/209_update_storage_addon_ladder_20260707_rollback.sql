-- Roll back the July 7, 2026 recurring storage add-on ladder to the prior pending catalog.
-- This does not reactivate public acquisition without Stripe-backed operator activation.

update public.billing_storage_addon_offers
set acquisition_enabled = false,
    effective_end_at = coalesce(effective_end_at, now()),
    updated_at = now()
where acquisition_enabled = true
  and is_active = true
  and effective_end_at is null
  and storage_addon_id in (
      'storage_50gb',
      'storage_100gb',
      'storage_250gb',
      'storage_1tb'
  );

insert into public.billing_storage_addons (
    id,
    display_name,
    storage_limit_bytes,
    monthly_price_cents,
    stripe_price_id,
    is_active,
    sort_order
)
values
    ('storage_10gb', 'Extra 10 GB', 10::bigint * 1024 * 1024 * 1024, 700, null, true, 10),
    ('storage_50gb', 'Extra 50 GB', 50::bigint * 1024 * 1024 * 1024, 2900, null, true, 20),
    ('storage_100gb', 'Extra 100 GB', 100::bigint * 1024 * 1024 * 1024, 5900, null, true, 30),
    ('storage_250gb', 'Extra 250 GB', 250::bigint * 1024 * 1024 * 1024, 14900, null, true, 40),
    ('storage_1tb', 'Extra 1 TB', 1024::bigint * 1024 * 1024 * 1024, 8900, null, false, 95),
    ('storage_500gb', 'Extra 500 GB', 500::bigint * 1024 * 1024 * 1024, 29900, null, true, 50)
on conflict (id) do update
set display_name = excluded.display_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    monthly_price_cents = excluded.monthly_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

insert into public.billing_storage_addon_offers (
    id,
    storage_addon_id,
    offer_name,
    storage_limit_bytes,
    recurring_price_cents,
    stripe_price_id,
    acquisition_enabled,
    is_active,
    effective_start_at
)
values
    ('storage_10gb__pending_stripe', 'storage_10gb', 'Extra 10 GB Pending Stripe Price', 10::bigint * 1024 * 1024 * 1024, 700, null, false, true, null),
    ('storage_50gb__pending_stripe', 'storage_50gb', 'Extra 50 GB Pending Stripe Price', 50::bigint * 1024 * 1024 * 1024, 2900, null, false, true, null),
    ('storage_100gb__20260701_pending_stripe', 'storage_100gb', 'Extra 100 GB Pending Stripe Price', 100::bigint * 1024 * 1024 * 1024, 5900, null, false, true, null),
    ('storage_250gb__pending_stripe', 'storage_250gb', 'Extra 250 GB Pending Stripe Price', 250::bigint * 1024 * 1024 * 1024, 14900, null, false, true, null),
    ('storage_500gb__manual_review', 'storage_500gb', 'Extra 500 GB Manual Review', 500::bigint * 1024 * 1024 * 1024, 29900, null, false, true, null),
    ('storage_1tb__20260707_rollback_retired', 'storage_1tb', 'Extra 1 TB Retired', 1024::bigint * 1024 * 1024 * 1024, 8900, null, false, false, null)
on conflict (id) do update
set offer_name = excluded.offer_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    recurring_price_cents = excluded.recurring_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = false,
    is_active = excluded.is_active,
    effective_start_at = excluded.effective_start_at,
    updated_at = now();
