-- Add large-project output display records and checkpoint revision authority.
-- This keeps project workspace checkpoints lightweight while preserving
-- project-scoped output display/read authority for restore and previews.

do $$
begin
    if to_regclass('public.project_workspace_states') is null then
        raise exception 'public.project_workspace_states table is required before applying migration 145';
    end if;
end;
$$;

alter table public.project_workspace_states
    add column if not exists checkpoint_revision bigint;

update public.project_workspace_states
set checkpoint_revision = 1
where checkpoint_revision is null;

alter table public.project_workspace_states
    alter column checkpoint_revision set default 1,
    alter column checkpoint_revision set not null;

create index if not exists ix_project_workspace_states_user_checkpoint_revision
    on public.project_workspace_states (user_id, checkpoint_revision desc);

create table if not exists public.project_output_display_items (
    project_id uuid not null,
    user_id uuid not null references auth.users(id) on delete cascade,
    output_id text not null,
    version bigint not null default 1,
    source_snapshot_updated_at timestamptz not null default timezone('utc', now()),
    mode text,
    media_source text,
    created_at timestamptz,
    generation_id uuid,
    prompt_id uuid,
    task_id text,
    source_ref text,
    generation_trace_id text,
    preview_text text,
    display_prompt_summary text,
    mime_type text,
    width integer,
    height integer,
    duration_ms integer,
    preview_storage_path text,
    full_storage_path text,
    preview_poster_storage_path text,
    companion_art_storage_path text,
    preview_url_fallback text,
    preview_poster_url_fallback text,
    companion_art_url_fallback text,
    result_urls_fallback jsonb not null default '[]'::jsonb,
    saved_media_ids jsonb not null default '[]'::jsonb,
    task_state text,
    queue_state text,
    save_state text,
    status text,
    error_message_short text,
    hidden_in_reference_grid boolean not null default false,
    created_record_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint project_output_display_items_pk primary key (project_id, output_id),
    constraint project_output_display_items_project_scope_fk
      foreign key (project_id, user_id)
      references public.projects(id, user_id)
      on delete cascade,
    constraint project_output_display_items_generation_scope_fk
      foreign key (generation_id, user_id)
      references public.ai_generations(id, user_id)
      on delete cascade,
    constraint project_output_display_items_version_check
      check (version >= 1),
    constraint project_output_display_items_result_urls_array_check
      check (jsonb_typeof(result_urls_fallback) = 'array'),
    constraint project_output_display_items_saved_media_ids_array_check
      check (jsonb_typeof(saved_media_ids) = 'array'),
    constraint project_output_display_items_width_check
      check (width is null or width > 0),
    constraint project_output_display_items_height_check
      check (height is null or height > 0),
    constraint project_output_display_items_duration_check
      check (duration_ms is null or duration_ms >= 0)
);

create index if not exists ix_project_output_display_items_user_project
    on public.project_output_display_items (user_id, project_id, updated_at desc);

create index if not exists ix_project_output_display_items_project_updated
    on public.project_output_display_items (project_id, updated_at desc);

create index if not exists ix_project_output_display_items_project_generation
    on public.project_output_display_items (project_id, generation_id)
    where generation_id is not null;

create index if not exists ix_project_output_display_items_project_prompt
    on public.project_output_display_items (project_id, prompt_id)
    where prompt_id is not null;

create or replace function public.project_output_display_items_preserve_newest_source()
returns trigger
language plpgsql
as $$
declare
    v_workspace_snapshot_updated_at timestamptz;
begin
    if tg_op = 'INSERT' then
        if new.version is null or new.version < 1 then
            new.version := 1;
        end if;
        if new.source_snapshot_updated_at is null then
            new.source_snapshot_updated_at := timezone('utc', now());
        end if;
        if new.created_record_at is null then
            new.created_record_at := timezone('utc', now());
        end if;
        if new.updated_at is null then
            new.updated_at := timezone('utc', now());
        end if;
    else
        if new.source_snapshot_updated_at is null then
            new.source_snapshot_updated_at := old.source_snapshot_updated_at;
        end if;
    end if;

    select workspace.snapshot_updated_at
      into v_workspace_snapshot_updated_at
      from public.project_workspace_states workspace
     where workspace.project_id = new.project_id
       and workspace.user_id = new.user_id
     limit 1;

    if v_workspace_snapshot_updated_at is not null
        and new.source_snapshot_updated_at is not null
        and v_workspace_snapshot_updated_at > new.source_snapshot_updated_at then
        if tg_op = 'INSERT' then
            return null;
        end if;
        return old;
    end if;

    if tg_op = 'INSERT' then
        return new;
    end if;

    if old.source_snapshot_updated_at is not null
        and new.source_snapshot_updated_at is not null
        and new.source_snapshot_updated_at < old.source_snapshot_updated_at then
        return old;
    end if;

    new.project_id := old.project_id;
    new.user_id := old.user_id;
    new.output_id := old.output_id;
    new.created_record_at := old.created_record_at;

    if new.version is null or new.version <= old.version then
        new.version := old.version + 1;
    end if;
    if new.updated_at is null then
        new.updated_at := timezone('utc', now());
    end if;

    return new;
end;
$$;

drop trigger if exists trg_project_output_display_items_preserve_newest_source
    on public.project_output_display_items;

create trigger trg_project_output_display_items_preserve_newest_source
before insert or update on public.project_output_display_items
for each row
execute function public.project_output_display_items_preserve_newest_source();

with snapshot_outputs as (
    select
        workspace.project_id,
        workspace.user_id,
        workspace.snapshot_updated_at,
        output_item.value as output
    from public.project_workspace_states workspace
    cross join lateral jsonb_array_elements(
        case
            when jsonb_typeof(workspace.snapshot #> '{outputs,active}') = 'array'
                then workspace.snapshot #> '{outputs,active}'
            else '[]'::jsonb
        end
    ) as output_item(value)
),
normalized_outputs as (
    select
        project_id,
        user_id,
        snapshot_updated_at,
        nullif(btrim(output ->> 'id'), '') as output_id,
        nullif(btrim(output ->> 'mode'), '') as mode,
        nullif(btrim(output ->> 'mediaSource'), '') as media_source,
        case
            when (output ->> 'createdAt') ~ '^\d{4}-\d{2}-\d{2}T'
                then (output ->> 'createdAt')::timestamptz
            else null
        end as output_created_at,
        case
            when (output ->> 'generationId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
                then (output ->> 'generationId')::uuid
            else null
        end as generation_uuid,
        case
            when (output ->> 'promptId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$'
                then (output ->> 'promptId')::uuid
            else null
        end as prompt_id,
        nullif(btrim(output ->> 'taskId'), '') as task_id,
        nullif(btrim(output ->> 'sourceRef'), '') as source_ref,
        nullif(btrim(output ->> 'generationTraceId'), '') as generation_trace_id,
        nullif(btrim(output ->> 'previewText'), '') as preview_text,
        nullif(btrim(coalesce(output ->> 'prompt', output ->> 'previewText')), '')
            as display_prompt_summary,
        nullif(btrim(output ->> 'mimeType'), '') as mime_type,
        case
            when jsonb_typeof(output -> 'width') = 'number' then (output ->> 'width')::integer
            else null
        end as width,
        case
            when jsonb_typeof(output -> 'height') = 'number' then (output ->> 'height')::integer
            else null
        end as height,
        case
            when jsonb_typeof(output -> 'durationMs') = 'number' then (output ->> 'durationMs')::integer
            else null
        end as duration_ms,
        nullif(btrim(output ->> 'previewStoragePath'), '') as preview_storage_path,
        nullif(btrim(output ->> 'fullStoragePath'), '') as full_storage_path,
        nullif(btrim(output ->> 'previewPosterStoragePath'), '') as preview_poster_storage_path,
        nullif(btrim(output ->> 'companionArtStoragePath'), '') as companion_art_storage_path,
        nullif(btrim(output ->> 'previewUrl'), '') as preview_url_fallback,
        nullif(btrim(output ->> 'previewPosterUrl'), '') as preview_poster_url_fallback,
        nullif(btrim(output ->> 'companionArtUrl'), '') as companion_art_url_fallback,
        case
            when jsonb_typeof(output -> 'resultUrls') = 'array' then output -> 'resultUrls'
            else '[]'::jsonb
        end as result_urls_fallback,
        case
            when jsonb_typeof(output -> 'savedMediaIds') = 'array' then output -> 'savedMediaIds'
            else '[]'::jsonb
        end as saved_media_ids,
        nullif(btrim(output ->> 'taskState'), '') as task_state,
        nullif(btrim(output ->> 'queueState'), '') as queue_state,
        nullif(btrim(output ->> 'saveState'), '') as save_state,
        nullif(btrim(output ->> 'status'), '') as status,
        nullif(btrim(output ->> 'errorMessageShort'), '') as error_message_short,
        case
            when lower(output ->> 'hiddenInReferenceGrid') in ('true', 'false')
                then (output ->> 'hiddenInReferenceGrid')::boolean
            else false
        end as hidden_in_reference_grid
    from snapshot_outputs
)
insert into public.project_output_display_items (
    project_id,
    user_id,
    output_id,
    version,
    source_snapshot_updated_at,
    mode,
    media_source,
    created_at,
    generation_id,
    prompt_id,
    task_id,
    source_ref,
    generation_trace_id,
    preview_text,
    display_prompt_summary,
    mime_type,
    width,
    height,
    duration_ms,
    preview_storage_path,
    full_storage_path,
    preview_poster_storage_path,
    companion_art_storage_path,
    preview_url_fallback,
    preview_poster_url_fallback,
    companion_art_url_fallback,
    result_urls_fallback,
    saved_media_ids,
    task_state,
    queue_state,
    save_state,
    status,
    error_message_short,
    hidden_in_reference_grid
)
select
    normalized.project_id,
    normalized.user_id,
    normalized.output_id,
    1,
    normalized.snapshot_updated_at,
    normalized.mode,
    normalized.media_source,
    normalized.output_created_at,
    generation.id,
    normalized.prompt_id,
    normalized.task_id,
    normalized.source_ref,
    normalized.generation_trace_id,
    normalized.preview_text,
    normalized.display_prompt_summary,
    normalized.mime_type,
    normalized.width,
    normalized.height,
    normalized.duration_ms,
    normalized.preview_storage_path,
    normalized.full_storage_path,
    normalized.preview_poster_storage_path,
    normalized.companion_art_storage_path,
    normalized.preview_url_fallback,
    normalized.preview_poster_url_fallback,
    normalized.companion_art_url_fallback,
    normalized.result_urls_fallback,
    normalized.saved_media_ids,
    normalized.task_state,
    normalized.queue_state,
    normalized.save_state,
    normalized.status,
    normalized.error_message_short,
    normalized.hidden_in_reference_grid
from normalized_outputs normalized
left join public.ai_generations generation
    on generation.id = normalized.generation_uuid
    and generation.user_id = normalized.user_id
where normalized.output_id is not null
on conflict (project_id, output_id) do update
set
    version = public.project_output_display_items.version + 1,
    source_snapshot_updated_at = excluded.source_snapshot_updated_at,
    mode = excluded.mode,
    media_source = excluded.media_source,
    created_at = excluded.created_at,
    generation_id = excluded.generation_id,
    prompt_id = excluded.prompt_id,
    task_id = excluded.task_id,
    source_ref = excluded.source_ref,
    generation_trace_id = excluded.generation_trace_id,
    preview_text = excluded.preview_text,
    display_prompt_summary = excluded.display_prompt_summary,
    mime_type = excluded.mime_type,
    width = excluded.width,
    height = excluded.height,
    duration_ms = excluded.duration_ms,
    preview_storage_path = excluded.preview_storage_path,
    full_storage_path = excluded.full_storage_path,
    preview_poster_storage_path = excluded.preview_poster_storage_path,
    companion_art_storage_path = excluded.companion_art_storage_path,
    preview_url_fallback = excluded.preview_url_fallback,
    preview_poster_url_fallback = excluded.preview_poster_url_fallback,
    companion_art_url_fallback = excluded.companion_art_url_fallback,
    result_urls_fallback = excluded.result_urls_fallback,
    saved_media_ids = excluded.saved_media_ids,
    task_state = excluded.task_state,
    queue_state = excluded.queue_state,
    save_state = excluded.save_state,
    status = excluded.status,
    error_message_short = excluded.error_message_short,
    hidden_in_reference_grid = excluded.hidden_in_reference_grid,
    updated_at = timezone('utc', now())
where public.project_output_display_items.source_snapshot_updated_at < excluded.source_snapshot_updated_at;

alter table public.project_output_display_items enable row level security;

drop policy if exists select_project_output_display_items_isolation on public.project_output_display_items;
create policy select_project_output_display_items_isolation
    on public.project_output_display_items
    for select
    using (auth.uid() = user_id);

drop policy if exists insert_project_output_display_items_isolation on public.project_output_display_items;
create policy insert_project_output_display_items_isolation
    on public.project_output_display_items
    for insert
    with check (auth.uid() = user_id);

drop policy if exists update_project_output_display_items_isolation on public.project_output_display_items;
create policy update_project_output_display_items_isolation
    on public.project_output_display_items
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists delete_project_output_display_items_isolation on public.project_output_display_items;
create policy delete_project_output_display_items_isolation
    on public.project_output_display_items
    for delete
    using (auth.uid() = user_id);

revoke all on table public.project_output_display_items from public, anon, authenticated;
grant all on table public.project_output_display_items to service_role;

create or replace function public.project_workspace_states_preserve_newest_snapshot()
returns trigger
language plpgsql
as $$
begin
    if tg_op = 'INSERT' then
        if new.snapshot_updated_at is null then
            new.snapshot_updated_at := coalesce(new.updated_at, timezone('utc', now()));
        end if;
        if new.checkpoint_revision is null or new.checkpoint_revision < 1 then
            new.checkpoint_revision := 1;
        end if;
        return new;
    end if;

    if new.snapshot_updated_at is null then
        new.snapshot_updated_at := old.snapshot_updated_at;
    end if;

    if old.snapshot_updated_at is not null
        and new.snapshot_updated_at is not null
        and new.snapshot_updated_at <= old.snapshot_updated_at then
        new.user_id := old.user_id;
        new.schema_version := old.schema_version;
        new.snapshot := old.snapshot;
        new.snapshot_updated_at := old.snapshot_updated_at;
        new.checkpoint_revision := old.checkpoint_revision;
        new.created_at := old.created_at;
        new.updated_at := old.updated_at;
        return new;
    end if;

    new.project_id := old.project_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;

    if new.snapshot is not distinct from old.snapshot then
        new.snapshot := old.snapshot;
        new.checkpoint_revision := old.checkpoint_revision;
        return new;
    end if;

    if new.checkpoint_revision is null or new.checkpoint_revision <= old.checkpoint_revision then
        new.checkpoint_revision := old.checkpoint_revision + 1;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_project_workspace_states_preserve_newest_snapshot
    on public.project_workspace_states;

create trigger trg_project_workspace_states_preserve_newest_snapshot
before insert or update on public.project_workspace_states
for each row
execute function public.project_workspace_states_preserve_newest_snapshot();
