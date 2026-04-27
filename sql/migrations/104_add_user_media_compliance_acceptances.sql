-- Add versioned per-user media compliance acceptance records for the protected app gate.

create table if not exists public.user_media_compliance_acceptances (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    agreement_key text not null,
    agreement_version text not null,
    accepted_at timestamptz not null default timezone('utc', now()),
    ip_address text,
    user_agent text,
    constraint user_media_compliance_acceptances_key_check
        check (
            agreement_key = btrim(agreement_key)
            and char_length(agreement_key) between 1 and 100
        ),
    constraint user_media_compliance_acceptances_version_check
        check (
            agreement_version = btrim(agreement_version)
            and char_length(agreement_version) between 1 and 50
        ),
    constraint user_media_compliance_acceptances_ip_address_length_check
        check (ip_address is null or char_length(ip_address) <= 255),
    constraint user_media_compliance_acceptances_user_agent_length_check
        check (user_agent is null or char_length(user_agent) <= 1000)
);

create unique index if not exists ix_user_media_compliance_acceptances_unique_version
    on public.user_media_compliance_acceptances (user_id, agreement_key, agreement_version);

create index if not exists ix_user_media_compliance_acceptances_user_lookup
    on public.user_media_compliance_acceptances (user_id, agreement_key, accepted_at desc);

alter table public.user_media_compliance_acceptances enable row level security;

drop policy if exists select_user_media_compliance_acceptances_isolation
    on public.user_media_compliance_acceptances;
create policy select_user_media_compliance_acceptances_isolation
    on public.user_media_compliance_acceptances
    for select
    using (user_id = auth.uid());

drop policy if exists insert_user_media_compliance_acceptances_isolation
    on public.user_media_compliance_acceptances;
create policy insert_user_media_compliance_acceptances_isolation
    on public.user_media_compliance_acceptances
    for insert
    with check (user_id = auth.uid());
