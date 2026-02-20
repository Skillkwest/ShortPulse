-- Roll back 021_generation_state_machine_constraints.sql trigger/functions.

drop trigger if exists trg_ai_generations_enforce_status_transition on public.ai_generations;
drop function if exists public.enforce_ai_generation_status_transition();
drop function if exists public.is_valid_ai_generation_transition(text, text);
