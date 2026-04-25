alter table billing_plans
drop column if exists stripe_product_id,
drop column if exists sort_order;
