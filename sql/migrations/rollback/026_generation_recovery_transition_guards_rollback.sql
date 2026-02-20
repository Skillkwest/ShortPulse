-- Rollback: restore strict status transition enforcement without guarded fail->success override.

create or replace function public.enforce_ai_generation_status_transition()
returns trigger
language plpgsql
as $$
begin
    if not public.is_valid_ai_generation_transition(old.status, new.status) then
        raise exception 'invalid ai_generations status transition from % to %', old.status, new.status
            using errcode = '22000';
    end if;
    return new;
end;
$$;
