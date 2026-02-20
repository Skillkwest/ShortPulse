-- Strict ai_generations status state machine enforcement.

create or replace function public.is_valid_ai_generation_transition(
    p_from text,
    p_to text
)
returns boolean
language sql
immutable
as $$
    select case
        when p_to is null then false
        when lower(p_to) not in ('pending', 'submitted', 'running', 'success', 'fail') then false
        when p_from is null then true
        when lower(p_from) = lower(p_to) then true
        when lower(p_from) in ('pending', 'submitted') and lower(p_to) in ('submitted', 'running', 'fail') then true
        when lower(p_from) = 'running' and lower(p_to) in ('success', 'fail') then true
        else false
    end;
$$;

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

drop trigger if exists trg_ai_generations_enforce_status_transition on public.ai_generations;

create trigger trg_ai_generations_enforce_status_transition
before update of status
on public.ai_generations
for each row
execute function public.enforce_ai_generation_status_transition();
