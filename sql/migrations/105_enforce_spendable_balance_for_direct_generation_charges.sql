-- Enforce spendable-balance admission for direct generation charges.
-- Direct provider lanes that debit ai_credit_ledger without using reservation
-- capture must not spend credits already held by active generation reservations.

create or replace function public.enforce_credit_ledger_insert()
returns trigger
language plpgsql
as $$
declare
    current_balance bigint;
    active_reserved_total bigint;
    is_reservation_capture boolean;
begin
    if new.change_cents = 0 then
        raise exception 'Credit change cannot be zero';
    end if;

    if new.change_cents > 0 and auth.uid() is not null and auth.role() <> 'service_role' then
        raise exception 'Positive credit adjustments require privileged context';
    end if;

    select coalesce(balance_cents, 0)
      into current_balance
      from public.ai_credit_balance
     where user_id = new.user_id;

    current_balance := coalesce(current_balance, 0);
    is_reservation_capture := coalesce((new.metadata ->> 'captured_from_reservation')::boolean, false);

    if new.change_cents < 0
       and new.source = 'generation_charge'
       and not is_reservation_capture then
        select coalesce(sum(r.amount_cents), 0)
          into active_reserved_total
          from public.ai_credit_reservations r
         where r.user_id = new.user_id
           and r.status = 'reserved';

        if current_balance - coalesce(active_reserved_total, 0) + new.change_cents < 0 then
            raise exception 'Insufficient credits';
        end if;
    elsif current_balance + new.change_cents < 0 then
        raise exception 'Insufficient credits';
    end if;

    if new.created_by is null and auth.uid() is not null then
        new.created_by := auth.uid();
    end if;

    return new;
end;
$$;
