-- Harden server-owned generation child tables against cross-owner lineage.
--
-- Production readback on 2026-07-11 found zero ownership mismatches. The
-- constraints are still introduced NOT VALID and then validated so a stale or
-- divergent target fails atomically instead of repairing or deleting data.

begin;

create unique index if not exists ux_generation_attempts_id_generation_user
    on public.generation_attempts (id, generation_id, user_id);

create unique index if not exists ux_ai_generation_outputs_id_generation_user
    on public.ai_generation_outputs (id, generation_id, user_id);

-- Parent uniqueness already exists from migration 093, but keep the migration
-- rerunnable for hosted databases that were bootstrapped from a partial schema.
create unique index if not exists ux_ai_generations_id_user
    on public.ai_generations (id, user_id);

create unique index if not exists ux_media_files_id_user
    on public.media_files (id, user_id);

alter table public.ai_generation_submit_queue
    add constraint ai_generation_submit_queue_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.ai_generations (id, user_id)
    on delete cascade
    not valid;

alter table public.generation_attempts
    add constraint generation_attempts_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.ai_generations (id, user_id)
    on delete cascade
    not valid;

alter table public.ai_generation_outputs
    add constraint ai_generation_outputs_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.ai_generations (id, user_id)
    on delete cascade
    not valid,
    add constraint ai_generation_outputs_attempt_owner_fk
    foreign key (generation_attempt_id, generation_id, user_id)
    references public.generation_attempts (id, generation_id, user_id)
    on delete set null (generation_attempt_id)
    not valid,
    add constraint ai_generation_outputs_media_owner_fk
    foreign key (media_file_id, user_id)
    references public.media_files (id, user_id)
    on delete set null (media_file_id)
    not valid;

alter table public.generation_publications
    add constraint generation_publications_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.ai_generations (id, user_id)
    on delete cascade
    not valid,
    add constraint generation_publications_attempt_owner_fk
    foreign key (generation_attempt_id, generation_id, user_id)
    references public.generation_attempts (id, generation_id, user_id)
    on delete set null (generation_attempt_id)
    not valid,
    add constraint generation_publications_output_owner_fk
    foreign key (generation_output_id, generation_id, user_id)
    references public.ai_generation_outputs (id, generation_id, user_id)
    on delete cascade
    not valid,
    add constraint generation_publications_media_owner_fk
    foreign key (owned_media_file_id, user_id)
    references public.media_files (id, user_id)
    on delete set null (owned_media_file_id)
    not valid;

alter table public.generation_projection
    add constraint generation_projection_generation_owner_fk
    foreign key (generation_id, user_id)
    references public.ai_generations (id, user_id)
    on delete cascade
    not valid,
    add constraint generation_projection_attempt_owner_fk
    foreign key (latest_attempt_id, generation_id, user_id)
    references public.generation_attempts (id, generation_id, user_id)
    on delete set null (latest_attempt_id)
    not valid;

alter table public.ai_generation_submit_queue
    validate constraint ai_generation_submit_queue_generation_owner_fk;
alter table public.generation_attempts
    validate constraint generation_attempts_generation_owner_fk;
alter table public.ai_generation_outputs
    validate constraint ai_generation_outputs_generation_owner_fk,
    validate constraint ai_generation_outputs_attempt_owner_fk,
    validate constraint ai_generation_outputs_media_owner_fk;
alter table public.generation_publications
    validate constraint generation_publications_generation_owner_fk,
    validate constraint generation_publications_attempt_owner_fk,
    validate constraint generation_publications_output_owner_fk,
    validate constraint generation_publications_media_owner_fk;
alter table public.generation_projection
    validate constraint generation_projection_generation_owner_fk,
    validate constraint generation_projection_attempt_owner_fk;

create or replace function public.reject_generation_child_owner_reassignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if new.user_id is distinct from old.user_id
       or new.generation_id is distinct from old.generation_id then
        raise exception 'Generation child ownership is immutable.'
            using errcode = '42501';
    end if;
    return new;
end;
$$;

revoke all on function public.reject_generation_child_owner_reassignment() from public, anon, authenticated;

drop trigger if exists trg_ai_generation_submit_queue_owner_immutable on public.ai_generation_submit_queue;
create trigger trg_ai_generation_submit_queue_owner_immutable
before update of generation_id, user_id on public.ai_generation_submit_queue
for each row execute function public.reject_generation_child_owner_reassignment();

drop trigger if exists trg_generation_attempts_owner_immutable on public.generation_attempts;
create trigger trg_generation_attempts_owner_immutable
before update of generation_id, user_id on public.generation_attempts
for each row execute function public.reject_generation_child_owner_reassignment();

drop trigger if exists trg_ai_generation_outputs_owner_immutable on public.ai_generation_outputs;
create trigger trg_ai_generation_outputs_owner_immutable
before update of generation_id, user_id on public.ai_generation_outputs
for each row execute function public.reject_generation_child_owner_reassignment();

drop trigger if exists trg_generation_publications_owner_immutable on public.generation_publications;
create trigger trg_generation_publications_owner_immutable
before update of generation_id, user_id on public.generation_publications
for each row execute function public.reject_generation_child_owner_reassignment();

drop trigger if exists trg_generation_projection_owner_immutable on public.generation_projection;
create trigger trg_generation_projection_owner_immutable
before update of generation_id, user_id on public.generation_projection
for each row execute function public.reject_generation_child_owner_reassignment();

-- These tables are server-owned write models. Authenticated clients retain the
-- scoped reads used by AI Studio hydration, but cannot insert, update, delete,
-- truncate, reference, or attach triggers directly.
revoke all on table public.ai_generation_submit_queue from public, anon, authenticated;
revoke all on table public.generation_attempts from public, anon, authenticated;
revoke all on table public.generation_publications from public, anon, authenticated;
revoke all on table public.generation_projection from public, anon, authenticated;
revoke all on table public.ai_generation_outputs from public, anon, authenticated;

grant select on table public.ai_generation_submit_queue to authenticated;
grant select on table public.generation_attempts to authenticated;
grant select on table public.generation_publications to authenticated;
grant select on table public.generation_projection to authenticated;
grant select on table public.ai_generation_outputs to authenticated;

grant select, insert, update, delete on table public.ai_generation_submit_queue to service_role;
grant select, insert, update, delete on table public.generation_attempts to service_role;
grant select, insert, update, delete on table public.generation_publications to service_role;
grant select, insert, update, delete on table public.generation_projection to service_role;
grant select, insert, update, delete on table public.ai_generation_outputs to service_role;

drop policy if exists modify_ai_generation_submit_queue_isolation on public.ai_generation_submit_queue;
drop policy if exists modify_generation_attempts_isolation on public.generation_attempts;
drop policy if exists modify_generation_publications_isolation on public.generation_publications;
drop policy if exists modify_generation_projection_isolation on public.generation_projection;
drop policy if exists modify_ai_generation_outputs_isolation on public.ai_generation_outputs;

commit;
