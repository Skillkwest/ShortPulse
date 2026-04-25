alter table billing_plans
add column if not exists stripe_product_id text unique,
add column if not exists sort_order integer not null default 0;

update billing_plans
set sort_order = case id
  when 'free' then 0
  when 'media' then 10
  when 'studio' then 20
  when 'business' then 30
  else sort_order
end
where sort_order = 0;
