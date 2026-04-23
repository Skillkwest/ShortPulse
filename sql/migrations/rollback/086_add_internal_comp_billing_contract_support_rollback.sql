drop index if exists ix_billing_subscription_contracts_contract_source;

delete from billing_plan_offers
where id in ('media__internal_comp', 'studio__internal_comp', 'business__internal_comp');

alter table billing_subscription_contracts
    drop column if exists updated_by_user_id,
    drop column if exists grant_reason,
    drop column if exists granted_by_user_id,
    drop column if exists contract_source;
