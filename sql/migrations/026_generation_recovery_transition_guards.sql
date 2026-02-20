-- Guarded recovery transition support: allow fail -> success only for bounded recovery scenarios.

create or replace function public.enforce_ai_generation_status_transition()
returns trigger
language plpgsql
as $$
begin
    if lower(coalesce(old.status, '')) = 'fail'
       and lower(coalesce(new.status, '')) = 'success'
       and lower(coalesce(old.failure_reason_code, '')) = 'terminal_success_no_media'
       and lower(coalesce(old.recovery_state, '')) in ('queued', 'recovering', 'recovered')
       and lower(coalesce(new.recovery_state, '')) = 'recovered' then
        return new;
    end if;

    if not public.is_valid_ai_generation_transition(old.status, new.status) then
        raise exception 'invalid ai_generations status transition from % to %', old.status, new.status
            using errcode = '22000';
    end if;
    return new;
end;
$$;
