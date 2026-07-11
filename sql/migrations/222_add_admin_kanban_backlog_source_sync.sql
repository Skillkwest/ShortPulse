-- Add planning-backlog source metadata and sync RPC for admin Kanban.
-- Keeps docs/planning/backlog.md canonical while mirroring its items into the
-- Ophestivus board with typed source identity and audit history.

alter table public.admin_kanban_items
    add column if not exists source_type text not null default 'manual',
    add column if not exists source_key text,
    add column if not exists source_path text,
    add column if not exists source_section text,
    add column if not exists source_line integer,
    add column if not exists source_fingerprint text,
    add column if not exists source_synced_at timestamptz,
    add column if not exists source_missing_at timestamptz;

alter table public.admin_kanban_items
    drop constraint if exists admin_kanban_items_source_type_check;

alter table public.admin_kanban_items
    add constraint admin_kanban_items_source_type_check check (
        source_type in ('manual', 'admin_error', 'planning_backlog')
    );

alter table public.admin_kanban_items
    drop constraint if exists admin_kanban_items_source_key_format_check;

alter table public.admin_kanban_items
    add constraint admin_kanban_items_source_key_format_check check (
        source_key is null
        or (
            source_key = btrim(source_key)
            and char_length(source_key) between 1 and 120
        )
    );

alter table public.admin_kanban_items
    drop constraint if exists admin_kanban_items_source_metadata_check;

alter table public.admin_kanban_items
    add constraint admin_kanban_items_source_metadata_check check (
        (source_path is null or char_length(source_path) <= 240)
        and (source_section is null or char_length(source_section) <= 160)
        and (source_line is null or source_line > 0)
        and (source_fingerprint is null or char_length(source_fingerprint) = 64)
        and (source_type <> 'planning_backlog' or source_key is not null)
    );

create unique index if not exists ux_admin_kanban_items_source_identity
    on public.admin_kanban_items (source_type, source_key)
    where source_key is not null;

create index if not exists ix_admin_kanban_items_active_source_status_sort
    on public.admin_kanban_items (source_type, status, sort_order, updated_at desc)
    where archived_at is null;

alter table public.admin_kanban_activity
    drop constraint if exists admin_kanban_activity_action_check;

alter table public.admin_kanban_activity
    add constraint admin_kanban_activity_action_check check (
        action in ('created', 'updated', 'moved', 'archived', 'synced')
    );

drop function if exists public.create_admin_kanban_item(text, text, uuid, text);

create or replace function public.create_admin_kanban_item(
    p_title text,
    p_details text default '',
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_source_type text default 'manual',
    p_source_key text default null,
    p_source_path text default null,
    p_source_section text default null,
    p_source_line integer default null,
    p_source_fingerprint text default null
)
returns public.admin_kanban_items
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_title text := btrim(coalesce(p_title, ''));
    v_details text := btrim(coalesce(p_details, ''));
    v_source_type text := lower(btrim(coalesce(p_source_type, 'manual')));
    v_source_key text := nullif(lower(btrim(coalesce(p_source_key, ''))), '');
    v_source_path text := nullif(btrim(coalesce(p_source_path, '')), '');
    v_source_section text := nullif(btrim(coalesce(p_source_section, '')), '');
    v_source_fingerprint text := nullif(lower(btrim(coalesce(p_source_fingerprint, ''))), '');
    v_sort_order integer;
    v_item public.admin_kanban_items%rowtype;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if char_length(v_title) < 1 or char_length(v_title) > 140 then
        raise exception 'Task title must be between 1 and 140 characters.' using errcode = '22023';
    end if;

    if char_length(v_details) > 1000 then
        raise exception 'Task notes must be 1000 characters or fewer.' using errcode = '22023';
    end if;

    if v_source_type not in ('manual', 'admin_error', 'planning_backlog') then
        raise exception 'source_type must be one of manual, admin_error, planning_backlog.' using errcode = '22023';
    end if;

    if v_source_type = 'planning_backlog' and v_source_key is null then
        raise exception 'source_key is required for planning backlog items.' using errcode = '22023';
    end if;

    select coalesce(max(sort_order), 0) + 1
    into v_sort_order
    from public.admin_kanban_items
    where archived_at is null;

    insert into public.admin_kanban_items (
        title,
        details,
        status,
        sort_order,
        created_by,
        updated_by,
        source_type,
        source_key,
        source_path,
        source_section,
        source_line,
        source_fingerprint,
        source_synced_at
    )
    values (
        v_title,
        v_details,
        'backlog',
        v_sort_order,
        p_actor_user_id,
        p_actor_user_id,
        v_source_type,
        v_source_key,
        v_source_path,
        v_source_section,
        p_source_line,
        v_source_fingerprint,
        case when v_source_type = 'planning_backlog' then timezone('utc', now()) else null end
    )
    returning * into v_item;

    insert into public.admin_kanban_activity (
        item_id,
        action,
        to_status,
        note,
        actor_user_id,
        actor_email
    )
    values (
        v_item.id,
        'created',
        v_item.status,
        v_item.title,
        p_actor_user_id,
        p_actor_email
    );

    return v_item;
end;
$$;

create or replace function public.sync_admin_kanban_planning_backlog_items(
    p_items jsonb,
    p_actor_user_id uuid default null,
    p_actor_email text default null,
    p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
    v_now timestamptz := timezone('utc', now());
    v_payload jsonb;
    v_source_key text;
    v_title text;
    v_details text;
    v_source_path text;
    v_source_section text;
    v_source_line integer;
    v_source_fingerprint text;
    v_sort_order integer;
    v_existing public.admin_kanban_items%rowtype;
    v_missing public.admin_kanban_items%rowtype;
    v_source_keys text[] := array[]::text[];
    v_created integer := 0;
    v_updated integer := 0;
    v_unchanged integer := 0;
    v_skipped_archived integer := 0;
    v_marked_missing integer := 0;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized' using errcode = '42501';
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' then
        raise exception 'p_items must be a JSON array.' using errcode = '22023';
    end if;

    for v_payload in select value from jsonb_array_elements(p_items)
    loop
        v_source_key := lower(btrim(coalesce(v_payload->>'sourceKey', '')));
        v_title := btrim(coalesce(v_payload->>'title', ''));
        v_details := btrim(coalesce(v_payload->>'details', ''));
        v_source_path := nullif(btrim(coalesce(v_payload->>'sourcePath', '')), '');
        v_source_section := nullif(btrim(coalesce(v_payload->>'sourceSection', '')), '');
        v_source_fingerprint := lower(btrim(coalesce(v_payload->>'sourceFingerprint', '')));
        v_source_line := nullif(v_payload->>'sourceLine', '')::integer;

        if v_source_key !~ '^spb-p[0-5]-[0-9]{3}$' then
            raise exception 'Invalid planning backlog source key: %', v_source_key using errcode = '22023';
        end if;
        if v_source_key = any(v_source_keys) then
            raise exception 'Duplicate planning backlog source key: %', v_source_key using errcode = '22023';
        end if;
        if char_length(v_title) < 1 or char_length(v_title) > 140 then
            raise exception 'Task title must be between 1 and 140 characters.' using errcode = '22023';
        end if;
        if char_length(v_details) > 1000 then
            raise exception 'Task notes must be 1000 characters or fewer.' using errcode = '22023';
        end if;
        if v_source_path is null or v_source_section is null or v_source_line is null or v_source_line < 1 then
            raise exception 'Planning backlog source metadata is incomplete for %.', v_source_key using errcode = '22023';
        end if;
        if v_source_fingerprint !~ '^[0-9a-f]{64}$' then
            raise exception 'Invalid planning backlog fingerprint for %.', v_source_key using errcode = '22023';
        end if;

        v_source_keys := array_append(v_source_keys, v_source_key);

        select *
        into v_existing
        from public.admin_kanban_items
        where source_type = 'planning_backlog'
          and source_key = v_source_key
        for update;

        if v_existing.id is null then
            v_created := v_created + 1;
            if not p_dry_run then
                select coalesce(max(sort_order), 0) + 1
                into v_sort_order
                from public.admin_kanban_items
                where archived_at is null;

                insert into public.admin_kanban_items (
                    title,
                    details,
                    status,
                    sort_order,
                    created_by,
                    updated_by,
                    source_type,
                    source_key,
                    source_path,
                    source_section,
                    source_line,
                    source_fingerprint,
                    source_synced_at
                )
                values (
                    v_title,
                    v_details,
                    'backlog',
                    v_sort_order,
                    p_actor_user_id,
                    p_actor_user_id,
                    'planning_backlog',
                    v_source_key,
                    v_source_path,
                    v_source_section,
                    v_source_line,
                    v_source_fingerprint,
                    v_now
                )
                returning * into v_existing;

                insert into public.admin_kanban_activity (
                    item_id,
                    action,
                    to_status,
                    note,
                    actor_user_id,
                    actor_email
                )
                values (
                    v_existing.id,
                    'created',
                    v_existing.status,
                    'Backlog document sync created card',
                    p_actor_user_id,
                    p_actor_email
                );
            end if;
        elsif v_existing.archived_at is not null then
            v_skipped_archived := v_skipped_archived + 1;
        elsif v_existing.title is distinct from v_title
            or v_existing.details is distinct from v_details
            or v_existing.source_path is distinct from v_source_path
            or v_existing.source_section is distinct from v_source_section
            or v_existing.source_line is distinct from v_source_line
            or v_existing.source_fingerprint is distinct from v_source_fingerprint
            or v_existing.source_missing_at is not null then
            v_updated := v_updated + 1;
            if not p_dry_run then
                update public.admin_kanban_items
                set
                    title = v_title,
                    details = v_details,
                    updated_by = p_actor_user_id,
                    source_path = v_source_path,
                    source_section = v_source_section,
                    source_line = v_source_line,
                    source_fingerprint = v_source_fingerprint,
                    source_synced_at = v_now,
                    source_missing_at = null
                where id = v_existing.id
                returning * into v_existing;

                insert into public.admin_kanban_activity (
                    item_id,
                    action,
                    to_status,
                    note,
                    actor_user_id,
                    actor_email
                )
                values (
                    v_existing.id,
                    'synced',
                    v_existing.status,
                    'Backlog document sync updated source card',
                    p_actor_user_id,
                    p_actor_email
                );
            end if;
        else
            v_unchanged := v_unchanged + 1;
        end if;
    end loop;

    for v_missing in
        select *
        from public.admin_kanban_items
        where source_type = 'planning_backlog'
          and archived_at is null
          and (source_key is null or not (source_key = any(v_source_keys)))
        for update
    loop
        v_marked_missing := v_marked_missing + 1;
        if not p_dry_run and v_missing.source_missing_at is null then
            update public.admin_kanban_items
            set
                source_missing_at = v_now,
                updated_by = p_actor_user_id
            where id = v_missing.id
            returning * into v_missing;

            insert into public.admin_kanban_activity (
                item_id,
                action,
                to_status,
                note,
                actor_user_id,
                actor_email
            )
            values (
                v_missing.id,
                'synced',
                v_missing.status,
                'Backlog document source missing; card retained for review',
                p_actor_user_id,
                p_actor_email
            );
        end if;
    end loop;

    return jsonb_build_object(
        'dryRun', p_dry_run,
        'received', jsonb_array_length(p_items),
        'created', v_created,
        'updated', v_updated,
        'unchanged', v_unchanged,
        'skippedArchived', v_skipped_archived,
        'markedMissing', v_marked_missing
    );
end;
$$;

revoke all on function public.create_admin_kanban_item(
    text, text, uuid, text, text, text, text, text, integer, text
) from public;
revoke all on function public.create_admin_kanban_item(
    text, text, uuid, text, text, text, text, text, integer, text
) from anon;
revoke all on function public.create_admin_kanban_item(
    text, text, uuid, text, text, text, text, text, integer, text
) from authenticated;
grant execute on function public.create_admin_kanban_item(
    text, text, uuid, text, text, text, text, text, integer, text
) to service_role;

revoke all on function public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean) from public;
revoke all on function public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean) from anon;
revoke all on function public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean) from authenticated;
grant execute on function public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean) to service_role;

comment on column public.admin_kanban_items.source_type is
    'Board card source class: manual, admin_error, or planning_backlog.';
comment on column public.admin_kanban_items.source_key is
    'Stable source-local identity for mirrored board cards, such as docs/planning/backlog.md kanban ids.';
comment on function public.sync_admin_kanban_planning_backlog_items(jsonb, uuid, text, boolean) is
    'Service-role-only sync for mirroring docs/planning/backlog.md into admin Kanban planning_backlog cards.';
