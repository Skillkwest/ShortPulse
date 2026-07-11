-- Compatibility rollback for generation child least privilege.
--
-- Validated ownership constraints and owner-immutability triggers intentionally
-- remain in place. If runtime evidence proves that a still-canonical browser
-- path requires mutation temporarily, restore only authenticated row DML. Never
-- restore anon, TRUNCATE, REFERENCES, or TRIGGER authority.

begin;

grant insert, update, delete on table public.ai_generation_submit_queue to authenticated;
grant insert, update, delete on table public.generation_attempts to authenticated;
grant insert, update, delete on table public.generation_publications to authenticated;
grant insert, update, delete on table public.generation_projection to authenticated;
grant insert, update, delete on table public.ai_generation_outputs to authenticated;

drop policy if exists modify_ai_generation_submit_queue_isolation on public.ai_generation_submit_queue;
create policy modify_ai_generation_submit_queue_isolation
    on public.ai_generation_submit_queue for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists modify_generation_attempts_isolation on public.generation_attempts;
create policy modify_generation_attempts_isolation
    on public.generation_attempts for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists modify_generation_publications_isolation on public.generation_publications;
create policy modify_generation_publications_isolation
    on public.generation_publications for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists modify_generation_projection_isolation on public.generation_projection;
create policy modify_generation_projection_isolation
    on public.generation_projection for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists modify_ai_generation_outputs_isolation on public.ai_generation_outputs;
create policy modify_ai_generation_outputs_isolation
    on public.ai_generation_outputs for all
    using (user_id = auth.uid()) with check (user_id = auth.uid());

commit;
