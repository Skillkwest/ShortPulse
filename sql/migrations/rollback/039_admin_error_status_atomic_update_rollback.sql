-- Rollback: remove atomic admin incident status RPC.

drop function if exists public.admin_update_app_error_status(uuid, uuid, text, text, uuid, text);
