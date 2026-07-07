-- Repair recurring storage add-on catalog to the July 7, 2026 product ladder.
-- Stripe Price IDs below are the live monthly USD prices created for this cutover.

update public.billing_storage_addon_offers
set acquisition_enabled = false,
    effective_end_at = coalesce(effective_end_at, now()),
    updated_at = now()
where acquisition_enabled = true
  and is_active = true
  and effective_end_at is null
  and storage_addon_id in (
      'storage_10gb',
      'storage_50gb',
      'storage_100gb',
      'storage_250gb',
      'storage_500gb',
      'storage_1tb'
  )
  and id not in (
      'storage_50gb__month__stripe_20260707',
      'storage_100gb__month__stripe_20260707',
      'storage_250gb__month__stripe_20260707',
      'storage_1tb__month__stripe_20260707'
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
    ('storage_10gb', 'Extra 10 GB', 10::bigint * 1024 * 1024 * 1024, 700, null, false, 90),
    ('storage_50gb', 'Extra 50 GB', 50::bigint * 1024 * 1024 * 1024, 1000, 'price_1TqfqJHutZQpiTlZYwp39cuI', true, 10),
    ('storage_100gb', 'Extra 100 GB', 100::bigint * 1024 * 1024 * 1024, 2000, 'price_1TqfqJHutZQpiTlZvjJgFFVm', true, 20),
    ('storage_250gb', 'Extra 250 GB', 250::bigint * 1024 * 1024 * 1024, 3000, 'price_1TqfqJHutZQpiTlZ2RU1in26', true, 30),
    ('storage_1tb', 'Extra 1 TB', 1024::bigint * 1024 * 1024 * 1024, 8900, 'price_1TqfqKHutZQpiTlZx2xKmABF', true, 40),
    ('storage_500gb', 'Extra 500 GB', 500::bigint * 1024 * 1024 * 1024, 29900, null, false, 100)
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
    ('storage_10gb__20260707_retired', 'storage_10gb', 'Extra 10 GB Retired', 10::bigint * 1024 * 1024 * 1024, 700, null, false, false, null),
    ('storage_50gb__month__stripe_20260707', 'storage_50gb', 'Extra 50 GB July 2026 Offer', 50::bigint * 1024 * 1024 * 1024, 1000, 'price_1TqfqJHutZQpiTlZYwp39cuI', true, true, now()),
    ('storage_100gb__month__stripe_20260707', 'storage_100gb', 'Extra 100 GB July 2026 Offer', 100::bigint * 1024 * 1024 * 1024, 2000, 'price_1TqfqJHutZQpiTlZvjJgFFVm', true, true, now()),
    ('storage_250gb__month__stripe_20260707', 'storage_250gb', 'Extra 250 GB July 2026 Offer', 250::bigint * 1024 * 1024 * 1024, 3000, 'price_1TqfqJHutZQpiTlZ2RU1in26', true, true, now()),
    ('storage_1tb__month__stripe_20260707', 'storage_1tb', 'Extra 1 TB July 2026 Offer', 1024::bigint * 1024 * 1024 * 1024, 8900, 'price_1TqfqKHutZQpiTlZx2xKmABF', true, true, now()),
    ('storage_500gb__20260707_retired', 'storage_500gb', 'Extra 500 GB Retired', 500::bigint * 1024 * 1024 * 1024, 29900, null, false, false, null)
on conflict (id) do update
set offer_name = excluded.offer_name,
    storage_limit_bytes = excluded.storage_limit_bytes,
    recurring_price_cents = excluded.recurring_price_cents,
    stripe_price_id = excluded.stripe_price_id,
    acquisition_enabled = excluded.acquisition_enabled,
    is_active = excluded.is_active,
    effective_start_at = excluded.effective_start_at,
    effective_end_at = null,
    updated_at = now();
