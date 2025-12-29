-- ShortPulse schema bootstrap for Supabase/Postgres
create table if not exists reels_raw_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    reel_id text not null,
    platform text not null default 'instagram',
    reel_url text not null,
    scraped_at timestamptz not null,
    publish_time timestamptz not null,
    views integer not null,
    likes integer not null,
    comments integer not null,
    shares_or_saves integer,
    caption_text text,
    audio_id text,
    audio_name text,
    duration_seconds double precision,
    apify_run_id text not null,
    source_surface text not null default 'reels_feed',
    created_at timestamptz not null default now(),
    unique (user_id, reel_id, scraped_at, apify_run_id)
);

create index if not exists ix_reels_raw_events_reel_id_publish on reels_raw_events (user_id, reel_id, publish_time);
create index if not exists ix_reels_raw_events_scraped_at on reels_raw_events (user_id, scraped_at);
create index if not exists ix_reels_raw_events_publish_time on reels_raw_events (user_id, publish_time);

create table if not exists reels_latest_state (
    user_id uuid not null,
    reel_id text not null,
    platform text not null default 'instagram',
    reel_url text not null,
    publish_time timestamptz not null,
    latest_views integer not null,
    latest_likes integer not null,
    latest_comments integer not null,
    latest_shares_or_saves integer,
    latest_scraped_at timestamptz not null,
    caption_text text,
    audio_id text,
    audio_name text,
    duration_seconds double precision,
    updated_at timestamptz default now(),
    primary key (user_id, reel_id)
);

create index if not exists ix_reels_latest_state_publish_time on reels_latest_state (user_id, publish_time);

alter table reels_raw_events enable row level security;
drop policy if exists select_reels_raw_events_isolation on reels_raw_events;
create policy select_reels_raw_events_isolation on reels_raw_events
    for select using (user_id = auth.uid());
drop policy if exists modify_reels_raw_events_isolation on reels_raw_events;
create policy modify_reels_raw_events_isolation on reels_raw_events
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table reels_latest_state enable row level security;
drop policy if exists select_reels_latest_state_isolation on reels_latest_state;
create policy select_reels_latest_state_isolation on reels_latest_state
    for select using (user_id = auth.uid());
drop policy if exists modify_reels_latest_state_isolation on reels_latest_state;
create policy modify_reels_latest_state_isolation on reels_latest_state
    for all using (user_id = auth.uid()) with check (user_id = auth.uid());
