-- Software order droplist categories (per-store lookup_items).
-- Seed from distinct software_orders values onto store-1, then clone to store-2/3.

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('software_customer', 'Khách hàng / Thợ (PM)', 'shared', true, 200, true),
  ('software_device', 'Tên máy (PM)', 'shared', true, 210, true),
  ('software_quote', 'Báo giá (PM)', 'shared', true, 220, true),
  ('software_fee', 'Phí dịch vụ (PM)', 'shared', true, 230, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed store-1 from existing software_orders (text fields)
with s1 as (
  select id from public.stores where code = 'store-1' limit 1
),
src as (
  select distinct trim(customer_name) as label, 'software_customer' as cat_code
  from public.software_orders
  where length(trim(customer_name)) > 0
  union
  select distinct trim(device_name), 'software_device'
  from public.software_orders
  where length(trim(device_name)) > 0
  union
  -- money labels: digits only (stable parse) — UI may format display later
  select distinct quote::text, 'software_quote'
  from public.software_orders
  where quote >= 0
  union
  select distinct deposit::text, 'software_fee'
  from public.software_orders
  where deposit >= 0
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
select
  c.id,
  s1.id,
  coalesce(nullif(public.slugify_label(src.label), ''), 'item-' || substr(md5(src.label), 1, 8)),
  src.label,
  10 + (row_number() over (partition by src.cat_code order by src.label))::int * 10,
  false
from src
cross join s1
join public.lookup_categories c on c.code = src.cat_code
where length(trim(src.label)) > 0
  and not exists (
    select 1 from public.lookup_items i
    where i.category_id = c.id
      and i.store_id = s1.id
      and i.is_active
      and lower(i.label) = lower(src.label)
  );

-- Fallback seed if no orders yet
with s1 as (select id from public.stores where code = 'store-1' limit 1),
seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('software_customer', 'khach-mau', 'Khách mẫu', 10),
    ('software_device', 'bypass-icloud', 'Bypass iCloud', 10),
    ('software_quote', '100000', '100000', 10),
    ('software_quote', '200000', '200000', 20),
    ('software_fee', '0', '0', 10),
    ('software_fee', '50000', '50000', 20)
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
select c.id, s1.id, s.item_code, s.item_label, s.sort_order, true
from seed s
cross join s1
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and i.store_id = s1.id and i.is_active
);

-- Clone store-1 software_* items → store-2 / store-3
insert into public.lookup_items (
  category_id, store_id, code, label, sort_order, is_active, is_system, meta
)
select
  src.category_id,
  st.id,
  src.code,
  src.label,
  src.sort_order,
  src.is_active,
  src.is_system,
  coalesce(src.meta, '{}'::jsonb)
from public.lookup_items src
join public.lookup_categories c on c.id = src.category_id
cross join public.stores st
where st.code in ('store-2', 'store-3')
  and c.code in ('software_customer', 'software_device', 'software_quote', 'software_fee')
  and src.store_id = (select id from public.stores where code = 'store-1' limit 1)
  and src.is_active
  and not exists (
    select 1 from public.lookup_items x
    where x.category_id = src.category_id
      and x.store_id = st.id
      and lower(x.code) = lower(src.code)
      and x.is_active
  );
