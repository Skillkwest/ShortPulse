-- Restore the previous customer-facing credit top-up package labels.

update billing_credit_packages
set display_name = case id
    when 'starter_500' then 'Starter 500'
    when 'growth_2000' then 'Growth 2,000'
    when 'scale_6000' then 'Scale 6,000'
    when 'studio_10000' then 'Studio 10,000'
    else display_name
end
where id in ('starter_500', 'growth_2000', 'scale_6000', 'studio_10000');
