-- Reprice public credit top-up packages to the July 2026 numeric amount ladder.
-- New package ids are the granted credit amount. Retired legacy rows remain for
-- historical references but are no longer active checkout options.

insert into billing_credit_packages (
    id,
    display_name,
    credit_amount_cents,
    price_cents,
    stripe_price_id,
    is_active,
    sort_order
)
values
    ('100', '100 credits', 100, 500, null, false, 10),
    ('275', '275 credits', 275, 1200, null, false, 20),
    ('600', '600 credits', 600, 2500, null, false, 30),
    ('1200', '1,200 credits', 1200, 4900, null, false, 40),
    ('2500', '2,500 credits', 2500, 9900, null, false, 50),
    ('6800', '6,800 credits', 6800, 24900, null, false, 60),
    ('14500', '14,500 credits', 14500, 49900, null, false, 70),
    ('30500', '30,500 credits', 30500, 99900, null, false, 80)
on conflict (id) do update
set display_name = excluded.display_name,
    credit_amount_cents = excluded.credit_amount_cents,
    price_cents = excluded.price_cents,
    is_active = billing_credit_packages.stripe_price_id is not null or excluded.is_active,
    sort_order = excluded.sort_order;

update billing_credit_packages
set is_active = false,
    sort_order = case id
        when 'starter_500' then 1010
        when 'growth_2000' then 1020
        when 'scale_6000' then 1030
        when 'studio_10000' then 1040
        else sort_order
    end
where id in ('starter_500', 'growth_2000', 'scale_6000', 'studio_10000');
