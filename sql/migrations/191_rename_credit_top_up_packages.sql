-- Rename customer-facing credit top-up package labels to amount-only copy.
-- Package ids, prices, credit grants, Stripe linkage, and activation state are unchanged.

update billing_credit_packages
set display_name = case id
    when 'starter_500' then '500 credits'
    when 'growth_2000' then '2,000 credits'
    when 'scale_6000' then '6,000 credits'
    when 'studio_10000' then '10,000 credits'
    else display_name
end
where id in ('starter_500', 'growth_2000', 'scale_6000', 'studio_10000');
