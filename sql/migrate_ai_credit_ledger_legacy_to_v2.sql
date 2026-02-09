-- Align legacy `ai_credit_ledger` deployments with the v2 billing schema.
-- Safe to run multiple times.

-- Ensure `ai_credit_balance` exists. In some legacy deployments it is a view.
do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind is null then
        execute '
            create table ai_credit_balance (
                user_id uuid primary key references auth.users(id) on delete cascade,
                balance_cents bigint not null default 0,
                updated_at timestamptz not null default now()
            )';
        balance_relkind := 'r';
    end if;

    if balance_relkind in ('r', 'p') then
        execute 'alter table ai_credit_balance enable row level security';
        execute 'drop policy if exists select_ai_credit_balance_isolation on ai_credit_balance';
        execute 'create policy select_ai_credit_balance_isolation on ai_credit_balance
                 for select using (user_id = auth.uid())';
    else
        raise notice 'Skipping ai_credit_balance RLS policy setup because relation is a view/materialized view.';
    end if;
end
$$;

-- Add v2 ledger columns to legacy table shape.
alter table if exists ai_credit_ledger add column if not exists source text;
alter table if exists ai_credit_ledger add column if not exists source_ref text;
alter table if exists ai_credit_ledger add column if not exists metadata jsonb;
alter table if exists ai_credit_ledger add column if not exists created_by uuid references auth.users(id);

-- Backfill safe defaults for new columns.
update ai_credit_ledger
set source = coalesce(source, 'system')
where source is null;

update ai_credit_ledger
set metadata = '{}'::jsonb
where metadata is null;

-- Promote legacy `ref_id` into `source_ref` where applicable.
do $$
begin
    if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'ai_credit_ledger'
          and column_name = 'ref_id'
    ) then
        execute $q$
            update ai_credit_ledger
               set source_ref = coalesce(source_ref, ref_id)
             where source_ref is null
               and ref_id is not null
        $q$;
    end if;
end
$$;

alter table if exists ai_credit_ledger alter column source set default 'system';
alter table if exists ai_credit_ledger alter column source set not null;
alter table if exists ai_credit_ledger alter column metadata set default '{}'::jsonb;
alter table if exists ai_credit_ledger alter column metadata set not null;

create index if not exists ix_ai_credit_ledger_user_created
    on ai_credit_ledger (user_id, created_at desc);

-- Only create the unique source_ref index when existing data is clean.
do $$
begin
    if not exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = 'ai_credit_ledger'
          and indexname = 'ux_ai_credit_ledger_source_ref'
    ) then
        if not exists (
            select 1
            from ai_credit_ledger
            where source_ref is not null
            group by user_id, source, source_ref
            having count(*) > 1
        ) then
            execute 'create unique index ux_ai_credit_ledger_source_ref
                     on ai_credit_ledger (user_id, source, source_ref)
                     where source_ref is not null';
        else
            raise notice 'Skipped ux_ai_credit_ledger_source_ref creation because duplicate source_ref rows exist.';
        end if;
    end if;
end
$$;

alter table ai_credit_ledger enable row level security;
drop policy if exists select_ai_credit_ledger_isolation on ai_credit_ledger;
create policy select_ai_credit_ledger_isolation on ai_credit_ledger
    for select using (user_id = auth.uid());
drop policy if exists insert_ai_credit_ledger_user_debits on ai_credit_ledger;
create policy insert_ai_credit_ledger_user_debits on ai_credit_ledger
    for insert with check (
        user_id = auth.uid()
        and change_cents < 0
        and coalesce(created_by, auth.uid()) = auth.uid()
    );

create or replace function enforce_credit_ledger_insert()
returns trigger
language plpgsql
as $$
declare
    current_balance bigint;
begin
    if new.change_cents = 0 then
        raise exception 'Credit change cannot be zero';
    end if;

    if new.change_cents > 0 and auth.uid() is not null and auth.role() <> 'service_role' then
        raise exception 'Positive credit adjustments require privileged context';
    end if;

    select coalesce(balance_cents, 0)
      into current_balance
      from ai_credit_balance
     where user_id = new.user_id;

    current_balance := coalesce(current_balance, 0);
    if current_balance + new.change_cents < 0 then
        raise exception 'Insufficient credits';
    end if;

    if new.created_by is null and auth.uid() is not null then
        new.created_by := auth.uid();
    end if;

    return new;
end;
$$;

drop trigger if exists trg_enforce_credit_ledger_insert on ai_credit_ledger;
create trigger trg_enforce_credit_ledger_insert
before insert on ai_credit_ledger
for each row execute function enforce_credit_ledger_insert();

do $$
declare
    balance_relkind "char";
begin
    select c.relkind
      into balance_relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relname = 'ai_credit_balance';

    if balance_relkind in ('r', 'p') then
        execute '
            create or replace function apply_credit_balance_delta()
            returns trigger
            language plpgsql
            as $fn$
            begin
                insert into ai_credit_balance (user_id, balance_cents, updated_at)
                values (new.user_id, new.change_cents, now())
                on conflict (user_id) do update
                  set balance_cents = ai_credit_balance.balance_cents + excluded.balance_cents,
                      updated_at = now();
                return new;
            end;
            $fn$';

        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        execute 'create trigger trg_apply_credit_balance_delta
                 after insert on ai_credit_ledger
                 for each row execute function apply_credit_balance_delta()';
    else
        execute 'drop trigger if exists trg_apply_credit_balance_delta on ai_credit_ledger';
        raise notice 'Skipping apply_credit_balance_delta trigger because ai_credit_balance is not a table.';
    end if;
end
$$;
