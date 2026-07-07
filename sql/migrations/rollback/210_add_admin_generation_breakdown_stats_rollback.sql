-- Roll back the admin generation breakdown helper introduced by migration 210.

drop function if exists public.get_admin_generation_breakdown_v1();
