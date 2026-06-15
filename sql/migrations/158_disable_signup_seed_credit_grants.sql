-- Disable automatic signup credit grants for the hidden baseline fallback plan.
-- New users may get a baseline billing profile for account bootstrapping, but
-- paid credits must come from Stripe-backed subscription or top-up flows.

update public.billing_plans
   set monthly_credits_cents = 0,
       monthly_price_cents = 0,
       stripe_price_id = null,
       is_active = true
 where id = 'free';

create or replace function public.handle_new_user_billing_setup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    desired_plan text;
    has_profiles_table boolean;
    has_plans_table boolean;
    has_balance_table boolean;
    has_app_error_logs_table boolean;
    existing_error_id uuid;
    error_fingerprint text;
    exception_message text;
    exception_state text;
    exception_detail text;
    exception_hint text;
begin
    -- Never trust client-provided metadata for plan assignment at signup.
    desired_plan := 'free';

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_profiles'
           and c.relkind in ('r', 'p')
    ) into has_profiles_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'billing_plans'
           and c.relkind in ('r', 'p')
    ) into has_plans_table;

    select exists (
        select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relname = 'ai_credit_balance'
           and c.relkind in ('r', 'p')
    ) into has_balance_table;

    if not has_profiles_table or not has_plans_table then
        raise notice 'Skipping billing bootstrap because billing tables are missing.';
        return new;
    end if;

    insert into public.billing_plans (
        id,
        display_name,
        monthly_price_cents,
        monthly_credits_cents,
        stripe_price_id,
        is_active
    )
    values (desired_plan, 'Baseline fallback', 0, 0, null, true)
    on conflict (id) do update
      set display_name = excluded.display_name,
          monthly_price_cents = excluded.monthly_price_cents,
          monthly_credits_cents = excluded.monthly_credits_cents,
          stripe_price_id = excluded.stripe_price_id,
          is_active = true;

    insert into public.billing_profiles (user_id, plan_id, subscription_status)
    values (new.id, desired_plan, 'active')
    on conflict (user_id) do update
      set plan_id = excluded.plan_id,
          subscription_status = coalesce(
              public.billing_profiles.subscription_status,
              excluded.subscription_status
          );

    if has_balance_table then
        insert into public.ai_credit_balance (user_id, balance_cents)
        values (new.id, 0)
        on conflict (user_id) do nothing;
    end if;

    return new;
exception
    when others then
        get stacked diagnostics
            exception_message = message_text,
            exception_state = returned_sqlstate,
            exception_detail = pg_exception_detail,
            exception_hint = pg_exception_hint;

        begin
            select exists (
                select 1
                  from pg_class c
                  join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public'
                   and c.relname = 'app_error_logs'
                   and c.relkind in ('r', 'p')
            ) into has_app_error_logs_table;

            if has_app_error_logs_table then
                error_fingerprint := md5(
                    coalesce(exception_state, '') ||
                    '|handle_new_user_billing_setup|' ||
                    coalesce(exception_message, '')
                );

                select id
                  into existing_error_id
                  from public.app_error_logs
                 where fingerprint = error_fingerprint
                   and source = 'db.trigger.handle_new_user_billing_setup'
                   and status = 'open'
                   and user_id is not distinct from new.id
                 order by last_seen_at desc
                 limit 1;

                if existing_error_id is not null then
                    update public.app_error_logs
                       set last_seen_at = now(),
                           occurrences_count = greatest(coalesce(occurrences_count, 1), 1) + 1,
                           severity = 'high',
                           message = left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                           route = '/auth',
                           endpoint = 'auth.users',
                           http_status = 500,
                           user_email = coalesce(new.email, user_email),
                           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
                               'trigger_function', 'handle_new_user_billing_setup',
                               'trigger_table', 'auth.users',
                               'sqlstate', exception_state,
                               'detail', exception_detail,
                               'hint', exception_hint
                           )
                     where id = existing_error_id;
                else
                    insert into public.app_error_logs (
                        fingerprint,
                        source,
                        scope,
                        severity,
                        status,
                        message,
                        route,
                        endpoint,
                        http_status,
                        user_id,
                        user_email,
                        metadata,
                        first_seen_at,
                        last_seen_at
                    )
                    values (
                        error_fingerprint,
                        'db.trigger.handle_new_user_billing_setup',
                        'app',
                        'high',
                        'open',
                        left(coalesce(exception_message, 'Unknown trigger failure'), 600),
                        '/auth',
                        'auth.users',
                        500,
                        new.id,
                        new.email,
                        jsonb_build_object(
                            'trigger_function', 'handle_new_user_billing_setup',
                            'trigger_table', 'auth.users',
                            'sqlstate', exception_state,
                            'detail', exception_detail,
                            'hint', exception_hint
                        ),
                        now(),
                        now()
                    );
                end if;
            end if;
        exception
            when others then
                raise warning 'app_error_logs write failed in handle_new_user_billing_setup for user %: %',
                    new.id,
                    sqlerrm;
        end;

        raise warning 'handle_new_user_billing_setup failed for user %: %',
            new.id,
            coalesce(exception_message, sqlerrm);
        return new;
end;
$$;

revoke all on function public.handle_new_user_billing_setup() from public;

drop trigger if exists on_auth_user_created_billing_setup on auth.users;
create trigger on_auth_user_created_billing_setup
after insert on auth.users
for each row execute function public.handle_new_user_billing_setup();
