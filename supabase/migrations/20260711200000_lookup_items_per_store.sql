-- Lookup droplists per store.
-- Existing items → store-1 (Kim Chi). Clone active rows → store-2 / store-3.

-- 1) Column
alter table public.lookup_items
  add column if not exists store_id uuid references public.stores (id) on delete cascade;

-- 2) Existing data belongs to store-1
update public.lookup_items i
set store_id = s.id
from public.stores s
where s.code = 'store-1'
  and i.store_id is null;

-- Safety: any leftover nulls still go to store-1
update public.lookup_items i
set store_id = (select id from public.stores where code = 'store-1' limit 1)
where i.store_id is null;

alter table public.lookup_items
  alter column store_id set not null;

create index if not exists lookup_items_store_id_idx
  on public.lookup_items (store_id);

-- 3) Unique code per category+store (active only)
drop index if exists public.lookup_items_category_code_active_uidx;

create unique index if not exists lookup_items_category_store_code_active_uidx
  on public.lookup_items (category_id, store_id, lower(code))
  where is_active;

-- 4) Clone store-1 active items → store-2 / store-3 (independent droplists)
insert into public.lookup_items (
  category_id, store_id, code, label, sort_order, is_active, is_system, meta, created_by
)
select
  src.category_id,
  st.id as store_id,
  src.code,
  src.label,
  src.sort_order,
  src.is_active,
  src.is_system,
  coalesce(src.meta, '{}'::jsonb),
  null
from public.lookup_items src
cross join public.stores st
where st.code in ('store-2', 'store-3')
  and src.store_id = (select id from public.stores where code = 'store-1' limit 1)
  and src.is_active
  and not exists (
    select 1
    from public.lookup_items x
    where x.category_id = src.category_id
      and x.store_id = st.id
      and lower(x.code) = lower(src.code)
      and x.is_active
  );

-- 5) RPC helpers used by Supabase clients (app uses inventoryRepo; keep in sync)
drop function if exists public.lookup_list(text);
drop function if exists public.lookup_list(text, text);

create or replace function public.lookup_list(p_category_code text, p_store_code text default 'store-1')
returns setof public.lookup_items
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.lookup_items i
  join public.lookup_categories c on c.id = i.category_id
  join public.stores s on s.id = i.store_id
  where c.code = p_category_code
    and c.is_active
    and i.is_active
    and s.code = p_store_code
  order by i.sort_order, i.label;
$$;

grant execute on function public.lookup_list(text, text) to authenticated;
