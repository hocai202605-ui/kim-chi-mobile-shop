-- Phần mềm (online software jobs): real CRUD table, no business unique beyond PK.

create table if not exists public.software_orders (
  id              uuid primary key default gen_random_uuid(),
  customer_name   text not null,
  customer_type   text not null default 'Vãng lai',
  device_name     text not null,
  issue           text not null default '',
  quote           bigint not null check (quote >= 0),
  deposit         bigint not null check (deposit >= 0),
  receive_at      timestamptz not null default now(),
  complete_at     timestamptz,
  payment_at      timestamptz,
  payment_status  text not null default 'debt'
    check (payment_status in ('paid', 'debt')),
  reward_points   integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint software_orders_customer_name_nonempty check (length(trim(customer_name)) > 0),
  constraint software_orders_device_name_nonempty check (length(trim(device_name)) > 0)
);

create index if not exists software_orders_receive_at_idx
  on public.software_orders (receive_at desc);
create index if not exists software_orders_payment_status_idx
  on public.software_orders (payment_status);
create index if not exists software_orders_created_at_idx
  on public.software_orders (created_at desc);

-- Reuse set_updated_at if present from inventory foundation
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists software_orders_set_updated_at on public.software_orders;
    create trigger software_orders_set_updated_at
      before update on public.software_orders
      for each row execute function public.set_updated_at();
  end if;
end $$;
