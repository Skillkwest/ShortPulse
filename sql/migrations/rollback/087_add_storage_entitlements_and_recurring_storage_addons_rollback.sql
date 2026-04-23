drop trigger if exists trg_media_files_enforce_storage_quota on media_files;
drop function if exists enforce_media_storage_quota();

revoke execute on function get_media_storage_quota_summary() from authenticated, service_role;
revoke execute on function resolve_media_storage_addon_limit_bytes(uuid) from authenticated, service_role;
revoke execute on function resolve_media_storage_base_limit_bytes(uuid) from authenticated, service_role;

drop function if exists get_media_storage_quota_summary();
drop function if exists resolve_media_storage_addon_limit_bytes(uuid);
drop function if exists resolve_media_storage_base_limit_bytes(uuid);

drop trigger if exists trg_billing_subscription_storage_addons_updated_at on billing_subscription_storage_addons;
drop function if exists set_billing_subscription_storage_addon_updated_at();
drop table if exists billing_subscription_storage_addons;

drop trigger if exists trg_billing_storage_addon_offers_updated_at on billing_storage_addon_offers;
drop function if exists set_billing_storage_addon_offer_updated_at();
drop table if exists billing_storage_addon_offers;
drop table if exists billing_storage_addons;

alter table billing_subscription_contracts
    drop column if exists storage_limit_bytes;

alter table billing_plan_offers
    drop column if exists storage_limit_bytes;

alter table billing_plans
    drop column if exists storage_limit_bytes;
