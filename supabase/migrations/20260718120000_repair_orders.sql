-- Sửa chữa (shop repair orders): CRUD table + droplist categories.
-- Shape = software_orders + device_condition / warranty / imei / phone_or_pass.

create table if not exists public.repair_orders (
  id                uuid primary key default gen_random_uuid(),
  customer_name     text not null,
  customer_type     text not null default 'Vãng lai',
  device_name       text not null,
  issue             text not null default '',
  device_condition  text not null default '',
  warranty          text not null default '',
  imei              text not null default '',
  phone_or_pass     text not null default '',
  quote             bigint not null check (quote >= 0),
  deposit           bigint not null check (deposit >= 0),
  receive_at        timestamptz not null default now(),
  complete_at       timestamptz,
  payment_at        timestamptz,
  payment_status    text not null default 'debt'
    check (payment_status in ('paid', 'debt')),
  reward_points     integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        text,
  updated_by        text,
  constraint repair_orders_customer_name_nonempty check (length(trim(customer_name)) > 0),
  constraint repair_orders_device_name_nonempty check (length(trim(device_name)) > 0)
);

create index if not exists repair_orders_receive_at_idx
  on public.repair_orders (receive_at desc);
create index if not exists repair_orders_payment_status_idx
  on public.repair_orders (payment_status);
create index if not exists repair_orders_created_at_idx
  on public.repair_orders (created_at desc);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists repair_orders_set_updated_at on public.repair_orders;
    create trigger repair_orders_set_updated_at
      before update on public.repair_orders
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Droplist categories (per-store lookup_items)
insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('repair_customer', 'Khách hàng (Sửa chữa)', 'shared', true, 300, true),
  ('repair_device', 'Tên máy (Sửa chữa)', 'shared', true, 310, true),
  ('repair_condition', 'Tình trạng (Sửa chữa)', 'shared', true, 320, true),
  ('repair_warranty', 'Bảo hành (Sửa chữa)', 'shared', true, 330, true),
  ('repair_quote', 'Báo giá (Sửa chữa)', 'shared', true, 340, true),
  ('repair_fee', 'Phí dịch vụ (Sửa chữa)', 'shared', true, 350, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed demo orders (only if table empty)
insert into public.repair_orders (
  customer_name, customer_type, device_name, issue,
  device_condition, warranty, imei, phone_or_pass,
  quote, deposit, receive_at, complete_at, payment_at,
  payment_status, reward_points, created_by, updated_by
)
select * from (
  values
    (
      'Chị Lan', 'Vãng lai', 'iPhone XS', 'Thay pin — màn trầy nhẹ',
      'Màn trầy nhẹ', '1 tháng', '356938035643809', '0901 234 567 / 2580',
      650000::bigint, 200000::bigint,
      '2026-07-06 10:20:00+07'::timestamptz, null::timestamptz, null::timestamptz,
      'debt', 0, 'seed', 'seed'
    ),
    (
      'Anh Minh', 'Thân thiết', 'Samsung A52', 'Lỗi sạc — máy móp góc dưới',
      'Móp góc dưới', 'Không BH', '', 'Không có',
      450000::bigint, 0::bigint,
      '2026-07-05 14:00:00+07'::timestamptz, null::timestamptz, null::timestamptz,
      'debt', 0, 'seed', 'seed'
    ),
    (
      'Bạn Huy', 'Mới', 'iPhone 11 Pro Max', 'Ép kính',
      'Kính nứt', '3 tháng', '353918101234567', '111',
      900000::bigint, 300000::bigint,
      '2026-07-06 16:30:00+07'::timestamptz,
      '2026-07-07 11:00:00+07'::timestamptz,
      '2026-07-07 11:05:00+07'::timestamptz,
      'paid', 0, 'seed', 'seed'
    )
) as v(
  customer_name, customer_type, device_name, issue,
  device_condition, warranty, imei, phone_or_pass,
  quote, deposit, receive_at, complete_at, payment_at,
  payment_status, reward_points, created_by, updated_by
)
where not exists (select 1 from public.repair_orders limit 1);

-- Seed lookup items store-1 from repair_orders + fallback
with s1 as (
  select id from public.stores where code = 'store-1' limit 1
),
src as (
  select distinct trim(customer_name) as label, 'repair_customer' as cat_code
  from public.repair_orders
  where length(trim(customer_name)) > 0
  union
  select distinct trim(device_name), 'repair_device'
  from public.repair_orders
  where length(trim(device_name)) > 0
  union
  select distinct trim(device_condition), 'repair_condition'
  from public.repair_orders
  where length(trim(device_condition)) > 0
  union
  select distinct trim(warranty), 'repair_warranty'
  from public.repair_orders
  where length(trim(warranty)) > 0
  union
  select distinct quote::text, 'repair_quote'
  from public.repair_orders
  where quote >= 0
  union
  select distinct deposit::text, 'repair_fee'
  from public.repair_orders
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

with s1 as (select id from public.stores where code = 'store-1' limit 1),
seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('repair_customer', 'khach-le', 'Khách lẻ', 5),
    ('repair_customer', 'chi-lan', 'Chị Lan', 10),
    ('repair_device', 'iphone-xs', 'iPhone XS', 10),
    ('repair_device', 'iphone-13', 'iPhone 13', 20),
    ('repair_condition', 'man-tray', 'Màn trầy nhẹ', 10),
    ('repair_condition', 'can-kiem-tra', 'Cần kiểm tra', 20),
    ('repair_warranty', 'khong-bh', 'Không BH', 10),
    ('repair_warranty', '1-thang', '1 tháng', 20),
    ('repair_warranty', '3-thang', '3 tháng', 30),
    ('repair_quote', '450000', '450000', 10),
    ('repair_quote', '650000', '650000', 20),
    ('repair_fee', '0', '0', 10),
    ('repair_fee', '200000', '200000', 20)
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
select c.id, s1.id, s.item_code, s.item_label, s.sort_order, true
from seed s
cross join s1
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and i.store_id = s1.id and i.is_active
    and lower(i.label) = lower(s.item_label)
);

-- Clone store-1 repair_* items → store-2 / store-3
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
  and c.code in (
    'repair_customer', 'repair_device', 'repair_condition',
    'repair_warranty', 'repair_quote', 'repair_fee'
  )
  and src.store_id = (select id from public.stores where code = 'store-1' limit 1)
  and src.is_active
  and not exists (
    select 1 from public.lookup_items x
    where x.category_id = src.category_id
      and x.store_id = st.id
      and lower(x.code) = lower(src.code)
      and x.is_active
  );
