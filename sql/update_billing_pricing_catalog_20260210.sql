-- Billing pricing catalog refresh (2026-02-10)
-- Keeps 1 credit = $0.01 while setting sustainable subscription and top-up rates.
-- Safe to run multiple times.

update billing_plans
set monthly_price_cents = case id
  when 'free' then 0
  when 'media' then 1200
  when 'pro' then 3900
  when 'creative_suite' then 12900
  else monthly_price_cents
end,
monthly_credits_cents = case id
  when 'free' then 100
  when 'media' then 500
  when 'pro' then 2000
  when 'creative_suite' then 7500
  else monthly_credits_cents
end,
is_active = true
where id in ('free', 'media', 'pro', 'creative_suite');

update billing_credit_packages
set price_cents = case id
  when 'starter_500' then 700
  when 'growth_2000' then 2600
  when 'scale_6000' then 7800
  else price_cents
end,
credit_amount_cents = case id
  when 'starter_500' then 500
  when 'growth_2000' then 2000
  when 'scale_6000' then 6000
  else credit_amount_cents
end,
is_active = true,
sort_order = case id
  when 'starter_500' then 10
  when 'growth_2000' then 20
  when 'scale_6000' then 30
  else sort_order
end
where id in ('starter_500', 'growth_2000', 'scale_6000');

-- Verification
select id, display_name, monthly_price_cents, monthly_credits_cents
from billing_plans
where id in ('free', 'media', 'pro', 'creative_suite')
order by monthly_price_cents asc;

select id, display_name, credit_amount_cents, price_cents
from billing_credit_packages
where id in ('starter_500', 'growth_2000', 'scale_6000')
order by sort_order asc;
