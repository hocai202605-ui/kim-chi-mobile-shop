-- Nợ khác (nhập tay) cho màn Công nợ.
-- Xóa demo: delete from public.manual_debts where note like '%[DEMO-DEBT]%';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'manual_debt_status') then
    create type public.manual_debt_status as enum ('open', 'paid', 'cancelled');
  end if;
end $$;

create table if not exists public.manual_debts (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id),
  customer_name   text not null,
  customer_phone  text not null default '',
  title           text not null,
  amount          bigint not null check (amount >= 0),
  debt_date       date not null default (timezone('Asia/Ho_Chi_Minh', now()))::date,
  due_date        date,
  status          public.manual_debt_status not null default 'open',
  note            text not null default '',
  paid_at         timestamptz,
  cancelled_at    timestamptz,
  created_by      text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint manual_debts_customer_name_nonempty check (length(trim(customer_name)) > 0),
  constraint manual_debts_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists manual_debts_store_status_idx
  on public.manual_debts (store_id, status);
create index if not exists manual_debts_debt_date_idx
  on public.manual_debts (debt_date desc);
create index if not exists manual_debts_status_idx
  on public.manual_debts (status);

drop trigger if exists manual_debts_set_updated_at on public.manual_debts;
create trigger manual_debts_set_updated_at
  before update on public.manual_debts
  for each row execute function public.set_updated_at();

-- (Không seed demo — dữ liệu nợ tay chỉ nhập từ UI.)
