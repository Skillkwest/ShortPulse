-- Retire the removed Saved Creators feature and its browser-owned data table.
do $$
begin
  if to_regclass('public.saved_creators') is not null then
    drop policy if exists select_saved_creators_isolation on public.saved_creators;
    drop policy if exists modify_saved_creators_isolation on public.saved_creators;
  end if;
end $$;

drop table if exists public.saved_creators;
