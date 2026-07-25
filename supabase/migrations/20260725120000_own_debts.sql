-- Mình nợ: shop nợ người khác (NCC, vay mượn…).
-- Khác manual_debts (nợ tay / khách nợ shop trong Công nợ).

do $$
begin
  if not exists (select 1 from pg_type where typname = 'own_debt_status') then
    create type public.own_debt_status as enum ('open', 'paid', 'cancelled');
  end if;
end $$;

create table if not exists public.own_debts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id),
  creditor_name   text not null,
  debt_date       date not null default (timezone('Asia/Ho_Chi_Minh', now()))::date,
  debt_type       text not null,
  /** Số tiền short shop (cùng đơn vị UI kho / form MoneyInput). */
  amount          bigint not null check (amount >= 0),
  note            text not null default '',
  status          public.own_debt_status not null default 'open',
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  created_by      text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint own_debts_creditor_name_nonempty check (length(trim(creditor_name)) > 0),
  constraint own_debts_debt_type_nonempty check (length(trim(debt_type)) > 0)
);

create index if not exists own_debts_store_status_idx
  on public.own_debts (store_id, status);
create index if not exists own_debts_debt_date_idx
  on public.own_debts (debt_date desc);
create index if not exists own_debts_status_idx
  on public.own_debts (status);
create index if not exists own_debts_creditor_lower_idx
  on public.own_debts (lower(creditor_name));

drop trigger if exists own_debts_set_updated_at on public.own_debts;
create trigger own_debts_set_updated_at
  before update on public.own_debts
  for each row execute function public.set_updated_at();
