-- Harden scheduler timeout parity and add an aggregate admin error-events summary RPC.

create or replace function public.invoke_internal_billing_renewals_scheduler()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_url text;
  v_secret text;
  v_vercel_protection_bypass_token text;
  v_request_id bigint;
begin
  select s.decrypted_secret
    into v_run_url
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_internal_billing_renewals_run_url'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_secret
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_internal_billing_renewals_cron_secret'
  order by s.created_at desc
  limit 1;

  select s.decrypted_secret
    into v_vercel_protection_bypass_token
  from vault.decrypted_secrets s
  where s.name = 'shortpulse_vercel_protection_bypass_token'
  order by s.created_at desc
  limit 1;

  if coalesce(trim(v_run_url), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_internal_billing_renewals_run_url';
  end if;

  if coalesce(trim(v_secret), '') = '' then
    raise exception 'Missing Vault secret: shortpulse_internal_billing_renewals_cron_secret';
  end if;

  if v_run_url !~* '^https?://' then
    raise exception
      'Invalid shortpulse_internal_billing_renewals_run_url (must be http/https URL).';
  end if;

  select net.http_post(
    url := trim(v_run_url),
    headers := jsonb_strip_nulls(
      jsonb_build_object(
        'content-type', 'application/json',
        'authorization', format('Bearer %s', trim(v_secret)),
        'x-vercel-protection-bypass', nullif(trim(coalesce(v_vercel_protection_bypass_token, '')), '')
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
    into v_request_id;

  if v_request_id is null then
    raise exception 'Failed to enqueue HTTP request for internal billing renewals scheduler.';
  end if;
end;
$$;

comment on function public.invoke_internal_billing_renewals_scheduler()
is 'Supabase cron entrypoint for /api/internal/billing-contract-renewals/run.';

revoke all on function public.invoke_internal_billing_renewals_scheduler() from public;

create or replace function public.get_admin_error_events_summary_v1(
    p_since_15m timestamptz,
    p_since_hour timestamptz,
    p_since_24h timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_summary jsonb;
    v_admission_denied_telemetry jsonb;
begin
    if auth.role() <> 'service_role' then
        raise exception 'get_admin_error_events_summary_v1 requires service_role';
    end if;

    with admission_rows as (
        select
            occurred_at,
            case
                when lower(coalesce(metadata->>'tier', '')) in ('video_long', 'image_heavy', 'image_standard')
                    then lower(metadata->>'tier')
                else 'unknown'
            end as tier,
            case
                when lower(coalesce(metadata->>'reason', '')) in ('global_limit', 'tier_limit', 'global_and_tier_limit')
                    then lower(metadata->>'reason')
                else 'unknown'
            end as reason,
            case
                when lower(coalesce(metadata->>'admission_scope', '')) in ('per_user', 'shared_provider')
                    then lower(metadata->>'admission_scope')
                else 'unknown'
            end as admission_scope
        from public.app_error_events
        where source = 'telemetry.api.fal_submit.admission_limited'
          and occurred_at >= p_since_24h
    ),
    admission_counts as (
        select
            count(*) filter (where occurred_at >= p_since_15m) as total_15m,
            count(*) filter (where occurred_at >= p_since_hour) as total_hour,
            count(*) as total_24h,
            count(*) filter (where occurred_at >= p_since_15m and tier = 'video_long') as tier_video_long_15m,
            count(*) filter (where occurred_at >= p_since_15m and tier = 'image_heavy') as tier_image_heavy_15m,
            count(*) filter (where occurred_at >= p_since_15m and tier = 'image_standard') as tier_image_standard_15m,
            count(*) filter (where occurred_at >= p_since_15m and tier = 'unknown') as tier_unknown_15m,
            count(*) filter (where occurred_at >= p_since_hour and tier = 'video_long') as tier_video_long_hour,
            count(*) filter (where occurred_at >= p_since_hour and tier = 'image_heavy') as tier_image_heavy_hour,
            count(*) filter (where occurred_at >= p_since_hour and tier = 'image_standard') as tier_image_standard_hour,
            count(*) filter (where occurred_at >= p_since_hour and tier = 'unknown') as tier_unknown_hour,
            count(*) filter (where tier = 'video_long') as tier_video_long_24h,
            count(*) filter (where tier = 'image_heavy') as tier_image_heavy_24h,
            count(*) filter (where tier = 'image_standard') as tier_image_standard_24h,
            count(*) filter (where tier = 'unknown') as tier_unknown_24h,
            count(*) filter (where occurred_at >= p_since_15m and reason = 'global_limit') as reason_global_limit_15m,
            count(*) filter (where occurred_at >= p_since_15m and reason = 'tier_limit') as reason_tier_limit_15m,
            count(*) filter (where occurred_at >= p_since_15m and reason = 'global_and_tier_limit') as reason_global_and_tier_limit_15m,
            count(*) filter (where occurred_at >= p_since_15m and reason = 'unknown') as reason_unknown_15m,
            count(*) filter (where occurred_at >= p_since_hour and reason = 'global_limit') as reason_global_limit_hour,
            count(*) filter (where occurred_at >= p_since_hour and reason = 'tier_limit') as reason_tier_limit_hour,
            count(*) filter (where occurred_at >= p_since_hour and reason = 'global_and_tier_limit') as reason_global_and_tier_limit_hour,
            count(*) filter (where occurred_at >= p_since_hour and reason = 'unknown') as reason_unknown_hour,
            count(*) filter (where reason = 'global_limit') as reason_global_limit_24h,
            count(*) filter (where reason = 'tier_limit') as reason_tier_limit_24h,
            count(*) filter (where reason = 'global_and_tier_limit') as reason_global_and_tier_limit_24h,
            count(*) filter (where reason = 'unknown') as reason_unknown_24h,
            count(*) filter (where occurred_at >= p_since_15m and admission_scope = 'per_user') as scope_per_user_15m,
            count(*) filter (where occurred_at >= p_since_15m and admission_scope = 'shared_provider') as scope_shared_provider_15m,
            count(*) filter (where occurred_at >= p_since_15m and admission_scope = 'unknown') as scope_unknown_15m,
            count(*) filter (where occurred_at >= p_since_hour and admission_scope = 'per_user') as scope_per_user_hour,
            count(*) filter (where occurred_at >= p_since_hour and admission_scope = 'shared_provider') as scope_shared_provider_hour,
            count(*) filter (where occurred_at >= p_since_hour and admission_scope = 'unknown') as scope_unknown_hour,
            count(*) filter (where admission_scope = 'per_user') as scope_per_user_24h,
            count(*) filter (where admission_scope = 'shared_provider') as scope_shared_provider_24h,
            count(*) filter (where admission_scope = 'unknown') as scope_unknown_24h
        from admission_rows
    )
    select jsonb_build_object(
        'last15m', jsonb_build_object(
            'total', coalesce(total_15m, 0),
            'byTier', jsonb_build_object(
                'unknown', coalesce(tier_unknown_15m, 0),
                'video_long', coalesce(tier_video_long_15m, 0),
                'image_heavy', coalesce(tier_image_heavy_15m, 0),
                'image_standard', coalesce(tier_image_standard_15m, 0)
            ),
            'byReason', jsonb_build_object(
                'unknown', coalesce(reason_unknown_15m, 0),
                'global_limit', coalesce(reason_global_limit_15m, 0),
                'tier_limit', coalesce(reason_tier_limit_15m, 0),
                'global_and_tier_limit', coalesce(reason_global_and_tier_limit_15m, 0)
            ),
            'byScope', jsonb_build_object(
                'unknown', coalesce(scope_unknown_15m, 0),
                'per_user', coalesce(scope_per_user_15m, 0),
                'shared_provider', coalesce(scope_shared_provider_15m, 0)
            )
        ),
        'lastHour', jsonb_build_object(
            'total', coalesce(total_hour, 0),
            'byTier', jsonb_build_object(
                'unknown', coalesce(tier_unknown_hour, 0),
                'video_long', coalesce(tier_video_long_hour, 0),
                'image_heavy', coalesce(tier_image_heavy_hour, 0),
                'image_standard', coalesce(tier_image_standard_hour, 0)
            ),
            'byReason', jsonb_build_object(
                'unknown', coalesce(reason_unknown_hour, 0),
                'global_limit', coalesce(reason_global_limit_hour, 0),
                'tier_limit', coalesce(reason_tier_limit_hour, 0),
                'global_and_tier_limit', coalesce(reason_global_and_tier_limit_hour, 0)
            ),
            'byScope', jsonb_build_object(
                'unknown', coalesce(scope_unknown_hour, 0),
                'per_user', coalesce(scope_per_user_hour, 0),
                'shared_provider', coalesce(scope_shared_provider_hour, 0)
            )
        ),
        'last24h', jsonb_build_object(
            'total', coalesce(total_24h, 0),
            'byTier', jsonb_build_object(
                'unknown', coalesce(tier_unknown_24h, 0),
                'video_long', coalesce(tier_video_long_24h, 0),
                'image_heavy', coalesce(tier_image_heavy_24h, 0),
                'image_standard', coalesce(tier_image_standard_24h, 0)
            ),
            'byReason', jsonb_build_object(
                'unknown', coalesce(reason_unknown_24h, 0),
                'global_limit', coalesce(reason_global_limit_24h, 0),
                'tier_limit', coalesce(reason_tier_limit_24h, 0),
                'global_and_tier_limit', coalesce(reason_global_and_tier_limit_24h, 0)
            ),
            'byScope', jsonb_build_object(
                'unknown', coalesce(scope_unknown_24h, 0),
                'per_user', coalesce(scope_per_user_24h, 0),
                'shared_provider', coalesce(scope_shared_provider_24h, 0)
            )
        )
    )
      into v_admission_denied_telemetry
    from admission_counts;

    with event_counts as (
        select
            count(*) filter (where occurred_at >= p_since_15m) as last_15m_count,
            count(*) filter (where occurred_at >= p_since_15m and severity = 'high') as high_15m_count,
            count(*) filter (where occurred_at >= p_since_15m and scope = 'generation') as generation_15m_count,
            count(*) filter (where occurred_at >= p_since_hour) as last_hour_count,
            count(*) filter (where occurred_at >= p_since_24h) as last_24h_count,
            count(*) filter (where occurred_at >= p_since_24h and scope = 'app') as app_24h_count,
            count(*) filter (where occurred_at >= p_since_24h and scope = 'generation') as generation_24h_count,
            count(*) filter (where occurred_at >= p_since_24h and severity = 'high') as high_24h_count
        from public.app_error_events
        where source not like 'admin.synthetic_test.%'
          and source not like 'telemetry.%'
    ),
    signal_counts as (
        select
            count(*) filter (
                where occurred_at >= p_since_hour
                  and source = 'telemetry.character_mode'
                  and message = 'character_mode_reference_refresh_empty'
            ) as character_reference_empty_hour_count,
            count(*) filter (
                where occurred_at >= p_since_24h
                  and source = 'telemetry.character_mode'
                  and message = 'character_mode_reference_refresh_empty'
            ) as character_reference_empty_24h_count,
            count(*) filter (
                where occurred_at >= p_since_hour
                  and source = 'telemetry.character_mode'
                  and message = 'character_mode_injection_fallback.bundle_unavailable'
            ) as character_bundle_fallback_hour_count,
            count(*) filter (
                where occurred_at >= p_since_24h
                  and source = 'telemetry.character_mode'
                  and message = 'character_mode_injection_fallback.bundle_unavailable'
            ) as character_bundle_fallback_24h_count,
            count(*) filter (
                where occurred_at >= p_since_hour
                  and source = 'telemetry.ai_studio.project_workspace.repair_pending'
            ) as project_workspace_repair_pending_hour_count,
            count(*) filter (
                where occurred_at >= p_since_24h
                  and source = 'telemetry.ai_studio.project_workspace.repair_pending'
            ) as project_workspace_repair_pending_24h_count
        from public.app_error_events
        where occurred_at >= p_since_24h
          and source in (
              'telemetry.character_mode',
              'telemetry.ai_studio.project_workspace.repair_pending'
          )
    ),
    generation_counts as (
        select count(*) as provider_running_timeout_15m_count
        from public.ai_generations
        where status = 'fail'
          and failure_reason_code = 'provider_running_timeout'
          and completed_at >= p_since_15m
    )
    select jsonb_build_object(
        'last15mCount', coalesce(e.last_15m_count, 0),
        'high15mCount', coalesce(e.high_15m_count, 0),
        'generation15mCount', coalesce(e.generation_15m_count, 0),
        'providerRunningTimeout15mCount', coalesce(g.provider_running_timeout_15m_count, 0),
        'lastHourCount', coalesce(e.last_hour_count, 0),
        'last24hCount', coalesce(e.last_24h_count, 0),
        'app24hCount', coalesce(e.app_24h_count, 0),
        'generation24hCount', coalesce(e.generation_24h_count, 0),
        'high24hCount', coalesce(e.high_24h_count, 0),
        'characterModeReferenceRefreshEmptyLastHourCount', coalesce(s.character_reference_empty_hour_count, 0),
        'characterModeReferenceRefreshEmptyLast24hCount', coalesce(s.character_reference_empty_24h_count, 0),
        'characterModeBundleUnavailableFallbackLastHourCount', coalesce(s.character_bundle_fallback_hour_count, 0),
        'characterModeBundleUnavailableFallbackLast24hCount', coalesce(s.character_bundle_fallback_24h_count, 0),
        'projectWorkspaceRepairPendingLastHourCount', coalesce(s.project_workspace_repair_pending_hour_count, 0),
        'projectWorkspaceRepairPendingLast24hCount', coalesce(s.project_workspace_repair_pending_24h_count, 0),
        'admissionDeniedTelemetry', coalesce(v_admission_denied_telemetry, '{}'::jsonb)
    )
      into v_summary
    from event_counts e
    cross join signal_counts s
    cross join generation_counts g;

    return coalesce(v_summary, '{}'::jsonb);
end;
$$;

comment on function public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz)
is 'Service-role aggregate summary for the admin error-events workspace.';

revoke all on function public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz) from public;
revoke all on function public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz) from anon;
revoke all on function public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz) from authenticated;
grant execute on function public.get_admin_error_events_summary_v1(timestamptz, timestamptz, timestamptz) to service_role;
