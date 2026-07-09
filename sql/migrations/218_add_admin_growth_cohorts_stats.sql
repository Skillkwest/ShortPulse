-- Add service-role-only growth cohort analytics for /admin/stats conversion targets.

create or replace function public.get_admin_growth_cohorts_v1()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_payload jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can read admin growth cohorts v1';
    end if;

    with signup_rows as (
        select
            bp.user_id,
            bp.created_at as signed_up_at,
            u.email,
            gai.first_utm_source,
            gai.first_utm_campaign,
            gai.last_utm_source,
            gai.last_utm_campaign
        from public.billing_profiles bp
        left join auth.users u
          on u.id = bp.user_id
        left join public.growth_attribution_identities gai
          on gai.user_id = bp.user_id
    ),
    generation_rows as (
        select
            user_id,
            created_at,
            status
        from public.ai_generations
        where user_id is not null
    ),
    generation_summary as (
        select
            user_id,
            min(created_at) as first_generation_at,
            max(created_at) as last_generation_at,
            count(*)::bigint as generations_started,
            count(*) filter (where status = 'success')::bigint as successful_generations
        from generation_rows
        group by user_id
    ),
    saved_summary as (
        select
            user_id,
            min(created_at) as first_saved_at,
            count(*)::bigint as saved_outputs
        from public.media_events
        where user_id is not null
          and event_type = 'generation_saved'
        group by user_id
    ),
    current_subscription as (
        select
            user_id,
            min(created_at) as current_subscription_started_at
        from public.billing_subscription_contracts
        where contract_source = 'stripe'
          and lower(coalesce(plan_id, 'free')) <> 'free'
          and ended_at is null
          and lower(coalesce(status, 'active')) in ('active', 'trialing', 'past_due')
        group by user_id
    ),
    ever_paid_subscription as (
        select
            user_id,
            min(created_at) as paid_converted_at,
            max(ended_at) as last_subscription_ended_at
        from public.billing_subscription_contracts
        where contract_source = 'stripe'
          and lower(coalesce(plan_id, 'free')) <> 'free'
        group by user_id
    ),
    top_up_summary as (
        select
            user_id,
            count(*)::bigint as top_up_purchase_count,
            coalesce(sum(change_cents), 0)::bigint as top_up_credits_purchased,
            min(created_at) as first_top_up_at,
            max(created_at) as last_top_up_at
        from public.ai_credit_ledger
        where source = 'stripe_checkout'
          and change_cents > 0
        group by user_id
    ),
    active_storage_addons as (
        select
            user_id,
            count(*)::bigint as active_storage_addon_count,
            coalesce(sum(storage_limit_bytes * greatest(coalesce(quantity, 1), 1)), 0)::bigint
                as active_storage_addon_bytes,
            coalesce(sum(recurring_price_cents * greatest(coalesce(quantity, 1), 1)), 0)::bigint
                as active_storage_addon_price_cents,
            min(created_at) as first_storage_addon_at,
            max(created_at) as last_storage_addon_at
        from public.billing_subscription_storage_addons
        where ended_at is null
          and lower(status) in ('active', 'trialing', 'past_due')
        group by user_id
    ),
    intent_rows as (
        select
            user_id,
            max(occurred_at) as last_intent_at
        from public.app_error_events
        where user_id is not null
          and source in (
              'telemetry.billing.pricing_viewed',
              'telemetry.billing.upgrade_clicked',
              'telemetry.billing.checkout_started',
              'telemetry.billing.checkout_completed',
              'telemetry.ai_studio.generate_clicked'
          )
        group by user_id
    ),
    cohort_base as (
        select
            s.user_id,
            coalesce(nullif(trim(s.email), ''), 'Unknown user') as email,
            s.signed_up_at,
            coalesce(nullif(trim(s.first_utm_source), ''), nullif(trim(s.last_utm_source), ''), 'direct')
                as source_key,
            coalesce(nullif(trim(s.first_utm_campaign), ''), nullif(trim(s.last_utm_campaign), ''), 'none')
                as campaign_key,
            cs.current_subscription_started_at,
            eps.paid_converted_at,
            eps.last_subscription_ended_at,
            gs.first_generation_at,
            gs.last_generation_at,
            coalesce(gs.generations_started, 0::bigint) as generations_started,
            coalesce(gs.successful_generations, 0::bigint) as successful_generations,
            ss.first_saved_at,
            coalesce(ss.saved_outputs, 0::bigint) as saved_outputs,
            coalesce(tu.top_up_purchase_count, 0::bigint) as top_up_purchase_count,
            coalesce(tu.top_up_credits_purchased, 0::bigint) as top_up_credits_purchased,
            tu.last_top_up_at,
            coalesce(asa.active_storage_addon_count, 0::bigint) as active_storage_addon_count,
            coalesce(asa.active_storage_addon_bytes, 0::bigint) as active_storage_addon_bytes,
            coalesce(asa.active_storage_addon_price_cents, 0::bigint)
                as active_storage_addon_price_cents,
            asa.last_storage_addon_at,
            ir.last_intent_at
        from signup_rows s
        left join current_subscription cs
          on cs.user_id = s.user_id
        left join ever_paid_subscription eps
          on eps.user_id = s.user_id
        left join generation_summary gs
          on gs.user_id = s.user_id
        left join saved_summary ss
          on ss.user_id = s.user_id
        left join top_up_summary tu
          on tu.user_id = s.user_id
        left join active_storage_addons asa
          on asa.user_id = s.user_id
        left join intent_rows ir
          on ir.user_id = s.user_id
    ),
    cohort_classified as (
        select
            cb.*,
            (cb.current_subscription_started_at is not null) as is_currently_subscribed,
            (cb.paid_converted_at is not null) as ever_paid_converted,
            case
                when cb.current_subscription_started_at is not null then 'currently_subscribed'
                when cb.paid_converted_at is not null then 'lapsed_or_canceled'
                else 'never_subscribed'
            end as subscription_bucket,
            case
                when cb.generations_started <= 0 then 'no_generation'
                when cb.successful_generations <= 0 then 'generated_no_success'
                when cb.saved_outputs <= 0 then 'successful_no_save'
                else 'saved_output'
            end as generation_bucket,
            greatest(
                coalesce(cb.last_intent_at, '-infinity'::timestamptz),
                coalesce(cb.last_generation_at, '-infinity'::timestamptz),
                coalesce(cb.last_top_up_at, '-infinity'::timestamptz),
                coalesce(cb.last_storage_addon_at, '-infinity'::timestamptz)
            ) as last_activity_at
        from cohort_base cb
    ),
    summary as (
        select
            count(*)::bigint as signed_up,
            count(*) filter (where is_currently_subscribed)::bigint as currently_subscribed,
            count(*) filter (where not is_currently_subscribed)::bigint as signed_up_not_subscribed,
            count(*) filter (where subscription_bucket = 'never_subscribed')::bigint as never_subscribed,
            count(*) filter (where subscription_bucket = 'lapsed_or_canceled')::bigint as lapsed_or_canceled,
            count(*) filter (where not is_currently_subscribed and generation_bucket = 'no_generation')::bigint
                as not_subscribed_no_generation,
            count(*) filter (where not is_currently_subscribed and generations_started > 0)::bigint
                as not_subscribed_with_generation,
            count(*) filter (where not is_currently_subscribed and successful_generations > 0)::bigint
                as not_subscribed_with_success,
            count(*) filter (where not is_currently_subscribed and saved_outputs > 0)::bigint
                as not_subscribed_with_saved_output,
            count(*) filter (where ever_paid_converted)::bigint as ever_paid_converted,
            count(*) filter (where top_up_purchase_count > 0)::bigint as bought_credits,
            count(*) filter (where active_storage_addon_count > 0)::bigint as active_storage_addons,
            count(*) filter (where is_currently_subscribed and generations_started > 0)::bigint
                as subscribed_and_generated,
            count(*) filter (where is_currently_subscribed and generations_started = 0)::bigint
                as subscribed_no_generation,
            count(*) filter (where is_currently_subscribed and top_up_purchase_count > 0)::bigint
                as subscribed_bought_credits,
            count(*) filter (where is_currently_subscribed and active_storage_addon_count > 0)::bigint
                as subscribed_bought_storage_addons,
            count(*) filter (
                where is_currently_subscribed
                  and top_up_purchase_count > 0
                  and active_storage_addon_count > 0
            )::bigint as subscribed_bought_credits_and_addons
        from cohort_classified
    ),
    conversion_target_rows as (
        select
            user_id,
            email,
            signed_up_at,
            source_key,
            campaign_key,
            subscription_bucket,
            generation_bucket,
            first_generation_at,
            last_generation_at,
            successful_generations,
            saved_outputs,
            top_up_purchase_count,
            top_up_credits_purchased,
            active_storage_addon_bytes,
            active_storage_addon_price_cents,
            nullif(last_activity_at, '-infinity'::timestamptz) as last_activity_at,
            case
                when subscription_bucket = 'lapsed_or_canceled' then 'win_back'
                when generation_bucket = 'no_generation' then 'activate_first_generation'
                when generation_bucket = 'generated_no_success' then 'recover_generation_value'
                when generation_bucket = 'successful_no_save' then 'convert_successful_trial'
                else 'convert_engaged_non_subscriber'
            end as recommended_campaign_bucket
        from cohort_classified
        where not is_currently_subscribed
        order by
            case when generation_bucket = 'no_generation' then 0 else 1 end,
            last_activity_at desc nulls last,
            signed_up_at desc
        limit 200
    )
    select jsonb_build_object(
        'summary', jsonb_build_object(
            'signedUp', coalesce(s.signed_up, 0),
            'currentlySubscribed', coalesce(s.currently_subscribed, 0),
            'signedUpNotSubscribed', coalesce(s.signed_up_not_subscribed, 0),
            'neverSubscribed', coalesce(s.never_subscribed, 0),
            'lapsedOrCanceled', coalesce(s.lapsed_or_canceled, 0),
            'notSubscribedNoGeneration', coalesce(s.not_subscribed_no_generation, 0),
            'notSubscribedWithGeneration', coalesce(s.not_subscribed_with_generation, 0),
            'notSubscribedWithSuccess', coalesce(s.not_subscribed_with_success, 0),
            'notSubscribedWithSavedOutput', coalesce(s.not_subscribed_with_saved_output, 0),
            'everPaidConverted', coalesce(s.ever_paid_converted, 0),
            'boughtCredits', coalesce(s.bought_credits, 0),
            'activeStorageAddons', coalesce(s.active_storage_addons, 0),
            'subscribedAndGenerated', coalesce(s.subscribed_and_generated, 0),
            'subscribedNoGeneration', coalesce(s.subscribed_no_generation, 0),
            'subscribedBoughtCredits', coalesce(s.subscribed_bought_credits, 0),
            'subscribedBoughtStorageAddons', coalesce(s.subscribed_bought_storage_addons, 0),
            'subscribedBoughtCreditsAndAddons', coalesce(s.subscribed_bought_credits_and_addons, 0)
        ),
        'conversionTargetRows', coalesce((
            select jsonb_agg(
                jsonb_build_object(
                    'userId', ctr.user_id,
                    'email', ctr.email,
                    'signedUpAt', ctr.signed_up_at,
                    'sourceKey', ctr.source_key,
                    'campaignKey', ctr.campaign_key,
                    'subscriptionBucket', ctr.subscription_bucket,
                    'generationBucket', ctr.generation_bucket,
                    'firstGenerationAt', ctr.first_generation_at,
                    'lastGenerationAt', ctr.last_generation_at,
                    'successfulGenerations', ctr.successful_generations,
                    'savedOutputs', ctr.saved_outputs,
                    'topUpPurchaseCount', ctr.top_up_purchase_count,
                    'topUpCreditsPurchased', ctr.top_up_credits_purchased,
                    'activeStorageAddonBytes', ctr.active_storage_addon_bytes,
                    'activeStorageAddonPriceCents', ctr.active_storage_addon_price_cents,
                    'lastActivityAt', ctr.last_activity_at,
                    'recommendedCampaignBucket', ctr.recommended_campaign_bucket
                )
                order by ctr.signed_up_at desc, ctr.email asc
            )
            from conversion_target_rows ctr
        ), '[]'::jsonb)
    )
    into v_payload
    from summary s;

    return coalesce(
        v_payload,
        jsonb_build_object(
            'summary', jsonb_build_object(
                'signedUp', 0,
                'currentlySubscribed', 0,
                'signedUpNotSubscribed', 0,
                'neverSubscribed', 0,
                'lapsedOrCanceled', 0,
                'notSubscribedNoGeneration', 0,
                'notSubscribedWithGeneration', 0,
                'notSubscribedWithSuccess', 0,
                'notSubscribedWithSavedOutput', 0,
                'everPaidConverted', 0,
                'boughtCredits', 0,
                'activeStorageAddons', 0,
                'subscribedAndGenerated', 0,
                'subscribedNoGeneration', 0,
                'subscribedBoughtCredits', 0,
                'subscribedBoughtStorageAddons', 0,
                'subscribedBoughtCreditsAndAddons', 0
            ),
            'conversionTargetRows', '[]'::jsonb
        )
    );
end;
$$;

revoke all on function public.get_admin_growth_cohorts_v1() from public;
revoke all on function public.get_admin_growth_cohorts_v1() from anon;
revoke all on function public.get_admin_growth_cohorts_v1() from authenticated;
grant execute on function public.get_admin_growth_cohorts_v1() to service_role;
