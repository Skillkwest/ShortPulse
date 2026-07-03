-- Require a paid plan before creating persistent Media Library assets or prompts.
-- Baseline AI Studio access can open the workspace, but cannot add right-rail/library rows.

create or replace function public.user_has_paid_media_library_access(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.billing_subscription_contracts c
      where c.user_id = target_user_id
        and c.ended_at is null
        and lower(coalesce(c.plan_id, 'free')) <> 'free'
        and lower(coalesce(c.status, 'active')) in ('active', 'trialing', 'past_due', 'unpaid')
    )
    or exists (
      select 1
      from public.billing_profiles p
      where p.user_id = target_user_id
        and lower(coalesce(p.plan_id, 'free')) <> 'free'
        and lower(coalesce(p.subscription_status, 'active')) in ('active', 'trialing', 'past_due', 'unpaid')
    );
$$;

revoke all on function public.user_has_paid_media_library_access(uuid) from public;
grant execute on function public.user_has_paid_media_library_access(uuid) to authenticated;
grant execute on function public.user_has_paid_media_library_access(uuid) to service_role;

drop policy if exists modify_media_files_isolation on public.media_files;
drop policy if exists insert_media_files_paid_access on public.media_files;
drop policy if exists update_media_files_isolation on public.media_files;
drop policy if exists delete_media_files_isolation on public.media_files;

create policy insert_media_files_paid_access on public.media_files
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.user_has_paid_media_library_access(auth.uid())
  );

create policy update_media_files_isolation on public.media_files
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy delete_media_files_isolation on public.media_files
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists modify_media_prompts_isolation on public.media_prompts;
drop policy if exists insert_media_prompts_paid_access on public.media_prompts;
drop policy if exists update_media_prompts_isolation on public.media_prompts;
drop policy if exists delete_media_prompts_isolation on public.media_prompts;

create policy insert_media_prompts_paid_access on public.media_prompts
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.user_has_paid_media_library_access(auth.uid())
  );

create policy update_media_prompts_isolation on public.media_prompts
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy delete_media_prompts_isolation on public.media_prompts
  for delete
  to authenticated
  using (user_id = auth.uid());
