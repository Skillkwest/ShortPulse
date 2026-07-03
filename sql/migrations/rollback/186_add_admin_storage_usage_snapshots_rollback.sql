-- Roll back Admin Storage provider usage snapshots.
-- This removes operator-entered provider usage evidence for /admin/storage.

drop trigger if exists trg_admin_storage_usage_snapshots_updated_at
    on public.admin_storage_usage_snapshots;

drop function if exists public.set_admin_storage_usage_snapshots_updated_at();

drop table if exists public.admin_storage_usage_snapshots;
