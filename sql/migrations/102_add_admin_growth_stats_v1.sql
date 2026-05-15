-- Add admin growth analytics v1 support:
-- 1. anonymous/user attribution identity storage for first-touch/last-touch stitching
-- 2. service-role-only growth RPC for Marketing + Sales views on /admin/stats

create table if not exists public.growth_attribution_identities (
    anonymous_id text primary key,
    user_id uuid unique references auth.users(id) on delete set null,
    first_utm_source text,
    first_utm_medium text,
    first_utm_campaign text,
    first_landing_path text,
    first_referrer_host text,
    last_utm_source text,
    last_utm_medium text,
    last_utm_campaign text,
    last_landing_path text,
    last_referrer_host text,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    signup_submitted_at timestamptz,
    signup_completed_at timestamptz,
    stitched_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint growth_attribution_identities_anonymous_id_check
        check (length(trim(anonymous_id)) > 0 and length(trim(anonymous_id)) <= 120)
);

create index if not exists ix_growth_attribution_identities_user
    on public.growth_attribution_identities (user_id);
create index if not exists ix_growth_attribution_identities_signup_completed
    on public.growth_attribution_identities (signup_completed_at desc);
create index if not exists ix_growth_attribution_identities_first_source
    on public.growth_attribution_identities (first_utm_source);
create index if not exists ix_growth_attribution_identities_first_campaign
    on public.growth_attribution_identities (first_utm_campaign);

alter table public.growth_attribution_identities enable row level security;

drop policy if exists service_role_manage_growth_attribution_identities
    on public.growth_attribution_identities;
create policy service_role_manage_growth_attribution_identities
    on public.growth_attribution_identities
    for all to service_role
    using (true)
    with check (true);

create or replace function public.set_growth_attribution_identity_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

drop trigger if exists trg_growth_attribution_identities_updated_at
    on public.growth_attribution_identities;
create trigger trg_growth_attribution_identities_updated_at
before update on public.growth_attribution_identities
for each row execute function public.set_growth_attribution_identity_updated_at();

create or replace function public.get_admin_growth_stats_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_payload jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin growth stats v1';
    end if;

    with signup_rows as (
        select
            bp.user_id,
            bp.created_at as signed_up_at,
            u.email,
            gai.first_utm_source,
            gai.first_utm_medium,
            gai.first_utm_campaign,
            gai.last_utm_source,
            gai.last_utm_medium,
            gai.last_utm_campaign,
            gai.first_landing_path,
            gai.last_landing_path
        from public.billing_profiles bp
        left join auth.users u
          on u.id = bp.user_id
        left join public.growth_attribution_identities gai
          on gai.user_id = bp.user_id
    ),
    generate_click_rows as (
        select
            user_id,
            occurred_at
        from public.app_error_events
        where source = 'telemetry.ai_studio.generate_clicked'
          and user_id is not null
    ),
    generate_click_first as (
        select
            user_id,
            min(occurred_at) as first_generate_at
        from generate_click_rows
        group by user_id
    ),
    success_rows as (
        select
            user_id,
            created_at
        from public.ai_generations
        where user_id is not null
          and status = 'success'
    ),
    success_first as (
        select
            user_id,
            min(created_at) as first_success_at,
            count(*)::bigint as successful_generations
        from success_rows
        group by user_id
    ),
    saved_rows as (
        select
            user_id,
            created_at
        from public.media_events
        where user_id is not null
          and event_type = 'generation_saved'
    ),
    saved_first as (
        select
            user_id,
            min(created_at) as first_saved_at,
            count(*)::bigint as saved_outputs
        from saved_rows
        group by user_id
    ),
    project_attach_rows as (
        select
            user_id,
            created_at
        from public.project_generation_items
        where user_id is not null
    ),
    project_attach_first as (
        select
            user_id,
            min(created_at) as first_project_attach_at,
            count(*)::bigint as project_attached_generations
        from project_attach_rows
        group by user_id
    ),
    project_create_counts as (
        select
            user_id,
            count(*)::bigint as projects_created
        from public.projects
        group by user_id
    ),
    credit_spend_counts as (
        select
            user_id,
            abs(sum(least(change_cents, 0)))::bigint as credit_spend_cents
        from public.ai_credit_ledger
        where change_cents < 0
        group by user_id
    ),
    pricing_view_rows as (
        select
            user_id,
            occurred_at
        from public.app_error_events
        where source = 'telemetry.billing.pricing_viewed'
          and user_id is not null
    ),
    pricing_view_first as (
        select
            user_id,
            min(occurred_at) as pricing_viewed_at
        from pricing_view_rows
        group by user_id
    ),
    upgrade_click_rows as (
        select
            user_id,
            occurred_at
        from public.app_error_events
        where source = 'telemetry.billing.upgrade_clicked'
          and user_id is not null
    ),
    upgrade_click_first as (
        select
            user_id,
            min(occurred_at) as upgrade_clicked_at
        from upgrade_click_rows
        group by user_id
    ),
    checkout_started_rows as (
        select
            user_id,
            occurred_at
        from public.app_error_events
        where source = 'telemetry.billing.checkout_started'
          and user_id is not null
    ),
    checkout_started_first as (
        select
            user_id,
            min(occurred_at) as checkout_started_at
        from checkout_started_rows
        group by user_id
    ),
    checkout_completed_rows as (
        select
            user_id,
            occurred_at
        from public.app_error_events
        where source = 'telemetry.billing.checkout_completed'
          and user_id is not null
    ),
    checkout_completed_first as (
        select
            user_id,
            min(occurred_at) as checkout_completed_at
        from checkout_completed_rows
        group by user_id
    ),
    paid_contract_rows as (
        select
            user_id,
            min(created_at) as paid_converted_at
        from public.billing_subscription_contracts
        where plan_id <> 'free'
          and contract_source = 'stripe'
        group by user_id
    ),
    activity_rows as (
        select user_id, occurred_at as activity_at from generate_click_rows
        union all
        select user_id, created_at as activity_at from success_rows
        union all
        select user_id, created_at as activity_at from saved_rows
        union all
        select user_id, created_at as activity_at from project_attach_rows
    ),
    activity_days as (
        select distinct
            user_id,
            (activity_at at time zone 'utc')::date as activity_day
        from activity_rows
        where user_id is not null
    ),
    activity_day_counts as (
        select
            user_id,
            count(*)::bigint as active_days
        from activity_days
        group by user_id
    ),
    user_growth_base as (
        select
            s.user_id,
            s.email,
            s.signed_up_at,
            coalesce(nullif(trim(s.first_utm_source), ''), nullif(trim(s.last_utm_source), ''), 'direct') as source_key,
            coalesce(nullif(trim(s.first_utm_campaign), ''), nullif(trim(s.last_utm_campaign), ''), 'none') as campaign_key,
            coalesce(nullif(trim(s.first_landing_path), ''), nullif(trim(s.last_landing_path), ''), '/unknown') as landing_path,
            gc.first_generate_at,
            sf.first_success_at,
            sv.first_saved_at,
            pa.first_project_attach_at,
            coalesce(sv.saved_outputs, 0::bigint) as saved_outputs,
            coalesce(sf.successful_generations, 0::bigint) as successful_generations,
            coalesce(ad.active_days, 0::bigint) as active_days,
            coalesce(pc.projects_created, 0::bigint) as projects_created,
            coalesce(pa.project_attached_generations, 0::bigint) as project_attached_generations,
            coalesce(cs.credit_spend_cents, 0::bigint) as credit_spend_cents,
            pv.pricing_viewed_at,
            uc.upgrade_clicked_at,
            cso.checkout_started_at,
            cco.checkout_completed_at,
            pr.paid_converted_at,
            case
                when sv.first_saved_at is not null
                 and sv.first_saved_at <= s.signed_up_at + interval '7 days'
                    then sv.first_saved_at
                else null
            end as saved_activation_at,
            case
                when pa.first_project_attach_at is not null
                 and pa.first_project_attach_at <= s.signed_up_at + interval '7 days'
                    then pa.first_project_attach_at
                else null
            end as project_activation_at
        from signup_rows s
        left join generate_click_first gc
          on gc.user_id = s.user_id
        left join success_first sf
          on sf.user_id = s.user_id
        left join saved_first sv
          on sv.user_id = s.user_id
        left join project_attach_first pa
          on pa.user_id = s.user_id
        left join activity_day_counts ad
          on ad.user_id = s.user_id
        left join project_create_counts pc
          on pc.user_id = s.user_id
        left join credit_spend_counts cs
          on cs.user_id = s.user_id
        left join pricing_view_first pv
          on pv.user_id = s.user_id
        left join upgrade_click_first uc
          on uc.user_id = s.user_id
        left join checkout_started_first cso
          on cso.user_id = s.user_id
        left join checkout_completed_first cco
          on cco.user_id = s.user_id
        left join paid_contract_rows pr
          on pr.user_id = s.user_id
    ),
    user_growth as (
        select
            ugb.*,
            case
                when ugb.saved_activation_at is null then ugb.project_activation_at
                when ugb.project_activation_at is null then ugb.saved_activation_at
                else least(ugb.saved_activation_at, ugb.project_activation_at)
            end as activated_at
        from user_growth_base ugb
    ),
    user_growth_scored as (
        select
            ug.*,
            (
                case when ug.saved_outputs >= 3 then 1 else 0 end +
                case
                    when ug.projects_created >= 1 or ug.project_attached_generations >= 1 then 1
                    else 0
                end +
                case when ug.active_days >= 2 then 1 else 0 end +
                case when ug.successful_generations >= 5 then 1 else 0 end +
                case when ug.credit_spend_cents >= 100 then 1 else 0 end
            )::integer as pql_score,
            case
                when (
                    case when ug.saved_outputs >= 3 then 1 else 0 end +
                    case
                        when ug.projects_created >= 1 or ug.project_attached_generations >= 1 then 1
                        else 0
                    end +
                    case when ug.active_days >= 2 then 1 else 0 end +
                    case when ug.successful_generations >= 5 then 1 else 0 end +
                    case when ug.credit_spend_cents >= 100 then 1 else 0 end
                ) >= 2
                 and ug.activated_at is not null
                    then true
                else false
            end as is_pql
        from user_growth ug
    ),
    signups_summary as (
        select
            count(*)::bigint as total_signups,
            count(*) filter (where signed_up_at >= now() - interval '24 hours')::bigint as signups_last_24h,
            count(*) filter (where signed_up_at >= now() - interval '7 days')::bigint as signups_last_7d
        from user_growth_scored
    ),
    activated_summary as (
        select
            count(*) filter (where activated_at is not null)::bigint as total_activated,
            count(*) filter (where activated_at is not null and activated_at >= now() - interval '24 hours')::bigint as activated_last_24h,
            count(*) filter (where activated_at is not null and activated_at >= now() - interval '7 days')::bigint as activated_last_7d
        from user_growth_scored
    ),
    pql_summary as (
        select
            count(*) filter (where is_pql)::bigint as total_pql,
            count(*) filter (where is_pql and activated_at >= now() - interval '24 hours')::bigint as pql_last_24h,
            count(*) filter (where is_pql and activated_at >= now() - interval '7 days')::bigint as pql_last_7d
        from user_growth_scored
    ),
    pricing_view_summary as (
        select
            count(distinct user_id)::bigint as total_pricing_view_users,
            count(distinct user_id) filter (where occurred_at >= now() - interval '24 hours')::bigint as pricing_view_users_last_24h,
            count(distinct user_id) filter (where occurred_at >= now() - interval '7 days')::bigint as pricing_view_users_last_7d
        from pricing_view_rows
    ),
    upgrade_click_summary as (
        select
            count(distinct user_id)::bigint as total_upgrade_click_users,
            count(distinct user_id) filter (where occurred_at >= now() - interval '24 hours')::bigint as upgrade_click_users_last_24h,
            count(distinct user_id) filter (where occurred_at >= now() - interval '7 days')::bigint as upgrade_click_users_last_7d
        from upgrade_click_rows
    ),
    checkout_started_summary as (
        select
            count(distinct user_id)::bigint as total_checkout_started_users,
            count(distinct user_id) filter (where occurred_at >= now() - interval '24 hours')::bigint as checkout_started_users_last_24h,
            count(distinct user_id) filter (where occurred_at >= now() - interval '7 days')::bigint as checkout_started_users_last_7d
        from checkout_started_rows
    ),
    checkout_completed_summary as (
        select
            count(distinct user_id)::bigint as total_checkout_completed_users,
            count(distinct user_id) filter (where occurred_at >= now() - interval '24 hours')::bigint as checkout_completed_users_last_24h,
            count(distinct user_id) filter (where occurred_at >= now() - interval '7 days')::bigint as checkout_completed_users_last_7d
        from checkout_completed_rows
    ),
    paid_summary as (
        select
            count(*) filter (where paid_converted_at is not null)::bigint as total_paid_users,
            count(*) filter (where paid_converted_at is not null and paid_converted_at >= now() - interval '24 hours')::bigint as paid_users_last_24h,
            count(*) filter (where paid_converted_at is not null and paid_converted_at >= now() - interval '7 days')::bigint as paid_users_last_7d
        from user_growth_scored
    ),
    duration_summary as (
        select
            round((percentile_cont(0.5) within group (order by extract(epoch from (first_generate_at - signed_up_at)) / 3600.0))::numeric, 2)
                as signup_to_generate_hours,
            round((percentile_cont(0.5) within group (order by extract(epoch from (first_success_at - signed_up_at)) / 3600.0))::numeric, 2)
                as signup_to_success_hours,
            round((percentile_cont(0.5) within group (order by extract(epoch from (activated_at - signed_up_at)) / 3600.0))::numeric, 2)
                as signup_to_activation_hours,
            round((percentile_cont(0.5) within group (order by extract(epoch from (activated_at - first_generate_at)) / 3600.0))::numeric, 2)
                as generate_to_activation_hours
        from user_growth_scored
        where (first_generate_at is not null and first_generate_at >= signed_up_at)
           or (first_success_at is not null and first_success_at >= signed_up_at)
           or (activated_at is not null and activated_at >= signed_up_at)
    ),
    activated_retention_flags as (
        select
            ugs.user_id,
            ugs.activated_at,
            ugs.activated_at <= now() - interval '1 day' as eligible_d1,
            ugs.activated_at <= now() - interval '7 days' as eligible_d7,
            ugs.activated_at <= now() - interval '30 days' as eligible_d30,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.activated_at at time zone 'utc')::date + 1)
            ) as retained_d1,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.activated_at at time zone 'utc')::date + 7)
            ) as retained_d7,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.activated_at at time zone 'utc')::date + 30)
            ) as retained_d30
        from user_growth_scored ugs
        where ugs.activated_at is not null
    ),
    activated_retention_summary as (
        select
            count(*)::bigint as cohort_size,
            count(*) filter (where eligible_d1)::bigint as eligible_d1,
            count(*) filter (where eligible_d1 and retained_d1)::bigint as retained_d1,
            count(*) filter (where eligible_d7)::bigint as eligible_d7,
            count(*) filter (where eligible_d7 and retained_d7)::bigint as retained_d7,
            count(*) filter (where eligible_d30)::bigint as eligible_d30,
            count(*) filter (where eligible_d30 and retained_d30)::bigint as retained_d30
        from activated_retention_flags
    ),
    nonactivated_retention_flags as (
        select
            ugs.user_id,
            ugs.signed_up_at,
            ugs.signed_up_at <= now() - interval '1 day' as eligible_d1,
            ugs.signed_up_at <= now() - interval '7 days' as eligible_d7,
            ugs.signed_up_at <= now() - interval '30 days' as eligible_d30,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.signed_up_at at time zone 'utc')::date + 1)
            ) as retained_d1,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.signed_up_at at time zone 'utc')::date + 7)
            ) as retained_d7,
            exists (
                select 1
                from activity_days ad
                where ad.user_id = ugs.user_id
                  and ad.activity_day = ((ugs.signed_up_at at time zone 'utc')::date + 30)
            ) as retained_d30
        from user_growth_scored ugs
        where ugs.activated_at is null
    ),
    nonactivated_retention_summary as (
        select
            count(*)::bigint as cohort_size,
            count(*) filter (where eligible_d1)::bigint as eligible_d1,
            count(*) filter (where eligible_d1 and retained_d1)::bigint as retained_d1,
            count(*) filter (where eligible_d7)::bigint as eligible_d7,
            count(*) filter (where eligible_d7 and retained_d7)::bigint as retained_d7,
            count(*) filter (where eligible_d30)::bigint as eligible_d30,
            count(*) filter (where eligible_d30 and retained_d30)::bigint as retained_d30
        from nonactivated_retention_flags
    ),
    source_attribution_rows as (
        select
            source_key,
            count(*)::bigint as signups,
            count(*) filter (where activated_at is not null)::bigint as activated_users,
            count(*) filter (where is_pql)::bigint as pql_users,
            count(*) filter (where paid_converted_at is not null)::bigint as paid_users
        from user_growth_scored
        group by source_key
    ),
    campaign_attribution_rows as (
        select
            campaign_key,
            count(*)::bigint as signups,
            count(*) filter (where activated_at is not null)::bigint as activated_users,
            count(*) filter (where is_pql)::bigint as pql_users,
            count(*) filter (where paid_converted_at is not null)::bigint as paid_users
        from user_growth_scored
        group by campaign_key
    ),
    high_intent_rows as (
        select
            user_id,
            coalesce(nullif(trim(email), ''), 'Unknown user') as email,
            source_key,
            campaign_key,
            activated_at,
            pql_score,
            is_pql,
            saved_outputs,
            successful_generations,
            active_days,
            projects_created,
            project_attached_generations,
            credit_spend_cents,
            pricing_viewed_at,
            upgrade_clicked_at,
            checkout_started_at,
            checkout_completed_at,
            paid_converted_at
        from user_growth_scored
        where pql_score > 0
           or pricing_viewed_at is not null
           or upgrade_clicked_at is not null
           or checkout_started_at is not null
           or paid_converted_at is not null
        order by
            is_pql desc,
            paid_converted_at desc nulls last,
            checkout_started_at desc nulls last,
            pql_score desc,
            activated_at desc nulls last,
            signed_up_at desc
        limit 15
    )
    select jsonb_build_object(
        'marketing', jsonb_build_object(
            'summary', jsonb_build_object(
                'signups', jsonb_build_object(
                    'total', coalesce(ss.total_signups, 0),
                    'last24h', coalesce(ss.signups_last_24h, 0),
                    'last7d', coalesce(ss.signups_last_7d, 0)
                ),
                'activatedUsers', jsonb_build_object(
                    'total', coalesce(asu.total_activated, 0),
                    'last24h', coalesce(asu.activated_last_24h, 0),
                    'last7d', coalesce(asu.activated_last_7d, 0)
                ),
                'activationRatePct', jsonb_build_object(
                    'total',
                        coalesce(round((asu.total_activated::numeric * 1000) / nullif(ss.total_signups, 0)) / 10, 0),
                    'last24h',
                        coalesce(round((asu.activated_last_24h::numeric * 1000) / nullif(ss.signups_last_24h, 0)) / 10, 0),
                    'last7d',
                        coalesce(round((asu.activated_last_7d::numeric * 1000) / nullif(ss.signups_last_7d, 0)) / 10, 0)
                ),
                'medianHours', jsonb_build_object(
                    'signupToGenerate', ds.signup_to_generate_hours,
                    'signupToSuccess', ds.signup_to_success_hours,
                    'signupToActivation', ds.signup_to_activation_hours,
                    'generateToActivation', ds.generate_to_activation_hours
                )
            ),
            'retention', jsonb_build_object(
                'activated', jsonb_build_object(
                    'cohortSize', coalesce(ars.cohort_size, 0),
                    'eligibleD1', coalesce(ars.eligible_d1, 0),
                    'retainedD1', coalesce(ars.retained_d1, 0),
                    'd1RatePct', coalesce(round((ars.retained_d1::numeric * 1000) / nullif(ars.eligible_d1, 0)) / 10, 0),
                    'eligibleD7', coalesce(ars.eligible_d7, 0),
                    'retainedD7', coalesce(ars.retained_d7, 0),
                    'd7RatePct', coalesce(round((ars.retained_d7::numeric * 1000) / nullif(ars.eligible_d7, 0)) / 10, 0),
                    'eligibleD30', coalesce(ars.eligible_d30, 0),
                    'retainedD30', coalesce(ars.retained_d30, 0),
                    'd30RatePct', coalesce(round((ars.retained_d30::numeric * 1000) / nullif(ars.eligible_d30, 0)) / 10, 0)
                ),
                'nonActivated', jsonb_build_object(
                    'cohortSize', coalesce(nrs.cohort_size, 0),
                    'eligibleD1', coalesce(nrs.eligible_d1, 0),
                    'retainedD1', coalesce(nrs.retained_d1, 0),
                    'd1RatePct', coalesce(round((nrs.retained_d1::numeric * 1000) / nullif(nrs.eligible_d1, 0)) / 10, 0),
                    'eligibleD7', coalesce(nrs.eligible_d7, 0),
                    'retainedD7', coalesce(nrs.retained_d7, 0),
                    'd7RatePct', coalesce(round((nrs.retained_d7::numeric * 1000) / nullif(nrs.eligible_d7, 0)) / 10, 0),
                    'eligibleD30', coalesce(nrs.eligible_d30, 0),
                    'retainedD30', coalesce(nrs.retained_d30, 0),
                    'd30RatePct', coalesce(round((nrs.retained_d30::numeric * 1000) / nullif(nrs.eligible_d30, 0)) / 10, 0)
                )
            ),
            'attribution', jsonb_build_object(
                'sources', coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'sourceKey', sar.source_key,
                            'signups', sar.signups,
                            'activatedUsers', sar.activated_users,
                            'activationRatePct',
                                coalesce(round((sar.activated_users::numeric * 1000) / nullif(sar.signups, 0)) / 10, 0),
                            'pqlUsers', sar.pql_users,
                            'paidUsers', sar.paid_users
                        )
                        order by sar.signups desc, sar.activated_users desc, sar.source_key asc
                    )
                    from source_attribution_rows sar
                ), '[]'::jsonb),
                'campaigns', coalesce((
                    select jsonb_agg(
                        jsonb_build_object(
                            'campaignKey', car.campaign_key,
                            'signups', car.signups,
                            'activatedUsers', car.activated_users,
                            'activationRatePct',
                                coalesce(round((car.activated_users::numeric * 1000) / nullif(car.signups, 0)) / 10, 0),
                            'pqlUsers', car.pql_users,
                            'paidUsers', car.paid_users
                        )
                        order by car.signups desc, car.activated_users desc, car.campaign_key asc
                    )
                    from campaign_attribution_rows car
                ), '[]'::jsonb)
            )
        ),
        'sales', jsonb_build_object(
            'summary', jsonb_build_object(
                'pricingViewedUsers', jsonb_build_object(
                    'total', coalesce(pvs.total_pricing_view_users, 0),
                    'last24h', coalesce(pvs.pricing_view_users_last_24h, 0),
                    'last7d', coalesce(pvs.pricing_view_users_last_7d, 0)
                ),
                'upgradeClickedUsers', jsonb_build_object(
                    'total', coalesce(ucs.total_upgrade_click_users, 0),
                    'last24h', coalesce(ucs.upgrade_click_users_last_24h, 0),
                    'last7d', coalesce(ucs.upgrade_click_users_last_7d, 0)
                ),
                'checkoutStartedUsers', jsonb_build_object(
                    'total', coalesce(css.total_checkout_started_users, 0),
                    'last24h', coalesce(css.checkout_started_users_last_24h, 0),
                    'last7d', coalesce(css.checkout_started_users_last_7d, 0)
                ),
                'checkoutCompletedUsers', jsonb_build_object(
                    'total', coalesce(ccs.total_checkout_completed_users, 0),
                    'last24h', coalesce(ccs.checkout_completed_users_last_24h, 0),
                    'last7d', coalesce(ccs.checkout_completed_users_last_7d, 0)
                ),
                'paidConvertedUsers', jsonb_build_object(
                    'total', coalesce(ps.total_paid_users, 0),
                    'last24h', coalesce(ps.paid_users_last_24h, 0),
                    'last7d', coalesce(ps.paid_users_last_7d, 0)
                ),
                'pqlUsers', jsonb_build_object(
                    'total', coalesce(pqs.total_pql, 0),
                    'last24h', coalesce(pqs.pql_last_24h, 0),
                    'last7d', coalesce(pqs.pql_last_7d, 0)
                ),
                'activatedToPqlRatePct',
                    coalesce(round((pqs.total_pql::numeric * 1000) / nullif(asu.total_activated, 0)) / 10, 0),
                'pqlToPaidRatePct',
                    coalesce(round((ps.total_paid_users::numeric * 1000) / nullif(pqs.total_pql, 0)) / 10, 0)
            ),
            'highIntentUsers', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'userId', hir.user_id,
                        'email', hir.email,
                        'sourceKey', hir.source_key,
                        'campaignKey', hir.campaign_key,
                        'activatedAt', hir.activated_at,
                        'pqlScore', hir.pql_score,
                        'isPql', hir.is_pql,
                        'savedOutputs', hir.saved_outputs,
                        'successfulGenerations', hir.successful_generations,
                        'activeDays', hir.active_days,
                        'projectsCreated', hir.projects_created,
                        'projectAttachedGenerations', hir.project_attached_generations,
                        'creditSpendCents', hir.credit_spend_cents,
                        'pricingViewedAt', hir.pricing_viewed_at,
                        'upgradeClickedAt', hir.upgrade_clicked_at,
                        'checkoutStartedAt', hir.checkout_started_at,
                        'checkoutCompletedAt', hir.checkout_completed_at,
                        'paidConvertedAt', hir.paid_converted_at
                    )
                    order by
                        hir.is_pql desc,
                        hir.paid_converted_at desc nulls last,
                        hir.checkout_started_at desc nulls last,
                        hir.pql_score desc,
                        hir.activated_at desc nulls last,
                        hir.email asc
                )
                from high_intent_rows hir
            ), '[]'::jsonb)
        )
    )
    into v_payload
    from signups_summary ss
    cross join activated_summary asu
    cross join pql_summary pqs
    cross join pricing_view_summary pvs
    cross join upgrade_click_summary ucs
    cross join checkout_started_summary css
    cross join checkout_completed_summary ccs
    cross join paid_summary ps
    cross join duration_summary ds
    cross join activated_retention_summary ars
    cross join nonactivated_retention_summary nrs;

    return coalesce(
        v_payload,
        jsonb_build_object(
            'marketing', jsonb_build_object(
                'summary', jsonb_build_object(
                    'signups', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'activatedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'activationRatePct', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'medianHours', jsonb_build_object(
                        'signupToGenerate', null,
                        'signupToSuccess', null,
                        'signupToActivation', null,
                        'generateToActivation', null
                    )
                ),
                'retention', jsonb_build_object(
                    'activated', jsonb_build_object(
                        'cohortSize', 0, 'eligibleD1', 0, 'retainedD1', 0, 'd1RatePct', 0,
                        'eligibleD7', 0, 'retainedD7', 0, 'd7RatePct', 0,
                        'eligibleD30', 0, 'retainedD30', 0, 'd30RatePct', 0
                    ),
                    'nonActivated', jsonb_build_object(
                        'cohortSize', 0, 'eligibleD1', 0, 'retainedD1', 0, 'd1RatePct', 0,
                        'eligibleD7', 0, 'retainedD7', 0, 'd7RatePct', 0,
                        'eligibleD30', 0, 'retainedD30', 0, 'd30RatePct', 0
                    )
                ),
                'attribution', jsonb_build_object(
                    'sources', '[]'::jsonb,
                    'campaigns', '[]'::jsonb
                )
            ),
            'sales', jsonb_build_object(
                'summary', jsonb_build_object(
                    'pricingViewedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'upgradeClickedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'checkoutStartedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'checkoutCompletedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'paidConvertedUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'pqlUsers', jsonb_build_object('total', 0, 'last24h', 0, 'last7d', 0),
                    'activatedToPqlRatePct', 0,
                    'pqlToPaidRatePct', 0
                ),
                'highIntentUsers', '[]'::jsonb
            )
        )
    );
end;
$$;

revoke all on function public.get_admin_growth_stats_v1() from public;
revoke all on function public.get_admin_growth_stats_v1() from anon;
revoke all on function public.get_admin_growth_stats_v1() from authenticated;
grant execute on function public.get_admin_growth_stats_v1() to service_role;
