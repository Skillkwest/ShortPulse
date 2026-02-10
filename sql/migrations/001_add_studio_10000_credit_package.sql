-- Add a $100 credit package to billing catalog.
-- Keeps credit unit policy: 1 credit = $0.01.

insert into billing_credit_packages (id, display_name, credit_amount_cents, price_cents, stripe_price_id, is_active, sort_order)
values ('studio_10000', 'Studio 10,000', 10000, 10000, null, true, 40)
on conflict (id) do update
set display_name = excluded.display_name,
    credit_amount_cents = excluded.credit_amount_cents,
    price_cents = excluded.price_cents,
    is_active = excluded.is_active,
    sort_order = excluded.sort_order;

