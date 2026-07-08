-- Add private screenshot evidence for signed-in customer issue reports.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'issue_report_screenshots',
    'issue_report_screenshots',
    false,
    10485760,
    array[
        'image/gif',
        'image/jpeg',
        'image/png',
        'image/webp'
    ]::text[]
)
on conflict (id) do update
   set public = excluded.public,
       file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.user_issue_report_screenshots (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.user_issue_reports(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    storage_bucket text not null default 'issue_report_screenshots',
    storage_path text not null,
    original_filename text not null,
    content_type text not null,
    file_size_bytes integer not null,
    width integer,
    height integer,
    display_order integer not null default 0,
    created_at timestamptz not null default timezone('utc', now()),
    constraint user_issue_report_screenshots_bucket_check check (
        storage_bucket = 'issue_report_screenshots'
    ),
    constraint user_issue_report_screenshots_storage_path_check check (
        storage_path = btrim(storage_path)
        and char_length(storage_path) between 1 and 500
        and storage_path ~ '^issue-reports/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(gif|jpg|png|webp)$'
        and storage_path !~ '(^/|//|\\.\\.|\\\\)'
    ),
    constraint user_issue_report_screenshots_original_filename_check check (
        original_filename = btrim(original_filename)
        and char_length(original_filename) between 1 and 255
    ),
    constraint user_issue_report_screenshots_content_type_check check (
        content_type in ('image/gif', 'image/jpeg', 'image/png', 'image/webp')
    ),
    constraint user_issue_report_screenshots_file_size_check check (
        file_size_bytes > 0
        and file_size_bytes <= 10485760
    ),
    constraint user_issue_report_screenshots_dimensions_check check (
        (width is null or (width > 0 and width <= 100000))
        and (height is null or (height > 0 and height <= 100000))
    ),
    constraint user_issue_report_screenshots_display_order_check check (
        display_order between 0 and 2
    ),
    constraint user_issue_report_screenshots_storage_path_unique unique (storage_path),
    constraint user_issue_report_screenshots_report_order_unique unique (report_id, display_order)
);

create index if not exists ix_user_issue_report_screenshots_report_order
    on public.user_issue_report_screenshots (report_id, display_order asc);

create index if not exists ix_user_issue_report_screenshots_user_created_at
    on public.user_issue_report_screenshots (user_id, created_at desc);

alter table public.user_issue_report_screenshots enable row level security;

revoke all on table public.user_issue_report_screenshots from public;
revoke all on table public.user_issue_report_screenshots from anon;
revoke all on table public.user_issue_report_screenshots from authenticated;
grant all on table public.user_issue_report_screenshots to service_role;

comment on table public.user_issue_report_screenshots is
    'Private screenshot evidence attached to signed-in user issue reports.';

create or replace function public.create_user_issue_report_with_screenshots(
    p_user_id uuid,
    p_submitter_email text,
    p_message text,
    p_source_path text default null,
    p_user_agent text default null,
    p_screenshots jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_report_id uuid;
    v_screenshots jsonb := coalesce(p_screenshots, '[]'::jsonb);
    v_screenshot jsonb;
    v_display_order integer := 0;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can create issue reports with screenshots';
    end if;

    if jsonb_typeof(v_screenshots) <> 'array' then
        raise exception 'Issue report screenshots must be an array';
    end if;

    if jsonb_array_length(v_screenshots) > 3 then
        raise exception 'Issue reports may include at most 3 screenshots';
    end if;

    insert into public.user_issue_reports (
        user_id,
        submitter_email,
        message,
        source_path,
        user_agent
    )
    values (
        p_user_id,
        p_submitter_email,
        p_message,
        p_source_path,
        p_user_agent
    )
    returning id into v_report_id;

    for v_screenshot in
        select value from jsonb_array_elements(v_screenshots)
    loop
        insert into public.user_issue_report_screenshots (
            report_id,
            user_id,
            storage_bucket,
            storage_path,
            original_filename,
            content_type,
            file_size_bytes,
            width,
            height,
            display_order
        )
        values (
            v_report_id,
            p_user_id,
            'issue_report_screenshots',
            v_screenshot ->> 'storagePath',
            v_screenshot ->> 'originalFilename',
            v_screenshot ->> 'contentType',
            (v_screenshot ->> 'fileSizeBytes')::integer,
            nullif(v_screenshot ->> 'width', '')::integer,
            nullif(v_screenshot ->> 'height', '')::integer,
            v_display_order
        );

        v_display_order := v_display_order + 1;
    end loop;

    return v_report_id;
end;
$$;

revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from public;
revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) from authenticated;
grant execute on function public.create_user_issue_report_with_screenshots(
    uuid,
    text,
    text,
    text,
    text,
    jsonb
) to service_role;
