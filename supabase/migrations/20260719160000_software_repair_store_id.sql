-- Gắn cửa hàng thật cho Phần mềm / Sửa chữa (cô lập data theo CH).
-- Backfill: theo created_by → app_accounts.store_code; null → store-1 (Kim Chi).

alter table public.software_orders
  add column if not exists store_id uuid references public.stores (id);

alter table public.repair_orders
  add column if not exists store_id uuid references public.stores (id);

-- Backfill software_orders
update public.software_orders so
set store_id = s.id
from public.app_accounts a
join public.stores s on s.code = a.store_code
where so.store_id is null
  and so.created_by is not null
  and length(trim(so.created_by)) > 0
  and lower(a.username) = lower(trim(so.created_by));

update public.software_orders so
set store_id = (select id from public.stores where code = 'store-1' limit 1)
where so.store_id is null;

-- Backfill repair_orders
update public.repair_orders ro
set store_id = s.id
from public.app_accounts a
join public.stores s on s.code = a.store_code
where ro.store_id is null
  and ro.created_by is not null
  and length(trim(ro.created_by)) > 0
  and lower(a.username) = lower(trim(ro.created_by));

update public.repair_orders ro
set store_id = (select id from public.stores where code = 'store-1' limit 1)
where ro.store_id is null;

create index if not exists software_orders_store_id_idx
  on public.software_orders (store_id);

create index if not exists repair_orders_store_id_idx
  on public.repair_orders (store_id);
