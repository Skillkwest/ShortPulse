-- Add durable raw error payload capture for failed generated-output detail views.

do $$
begin
    if to_regclass('public.generation_projection') is null then
        raise exception 'public.generation_projection table is required before applying migration 157';
    end if;
end;
$$;

alter table public.generation_projection
    add column if not exists error_payload jsonb;
