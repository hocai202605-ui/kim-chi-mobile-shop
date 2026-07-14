-- Demo seed phụ kiện (tạm). Xóa sau bằng:
--   delete from public.accessories where code like 'DEMO-%' or note like '%[DEMO-SEED]%';
--   delete from public.lookup_items where code like 'demo-%' and category_id in (...);

-- Đảm bảo cột form phụ kiện
alter table public.accessories
  add column if not exists category text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists note text not null default '';

-- Đảm bảo lookup categories (idempotent)
insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('accessory_category', 'Danh mục phụ kiện', 'shared', true, 300, true),
  ('accessory_brand', 'Hãng phụ kiện', 'shared', true, 310, true),
  ('accessory_price', 'Giá bán phụ kiện', 'shared', true, 320, true),
  ('accessory_cost', 'Giá nhập phụ kiện', 'shared', true, 330, true),
  ('accessory_code', 'Mã hàng phụ kiện', 'shared', true, 340, true),
  ('accessory_name', 'Tên hàng phụ kiện', 'shared', true, 350, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed lookup options (3 store) — code prefix demo-
with stores as (
  select id, code from public.stores where code in ('store-1', 'store-2', 'store-3') and is_active
),
cats as (
  select id, code from public.lookup_categories
  where code in (
    'accessory_category', 'accessory_brand', 'accessory_price',
    'accessory_cost', 'accessory_code', 'accessory_name'
  )
),
labels (cat_code, label, sort_order) as (
  values
    ('accessory_category', 'Ốp lưng', 10),
    ('accessory_category', 'Cáp sạc', 20),
    ('accessory_category', 'Sạc nhanh', 30),
    ('accessory_category', 'Tai nghe', 40),
    ('accessory_brand', 'Apple', 10),
    ('accessory_brand', 'Baseus', 20),
    ('accessory_brand', 'Anker', 30),
    ('accessory_brand', 'Samsung', 40),
    ('accessory_code', 'DEMO-OP01', 10),
    ('accessory_code', 'DEMO-CAP20', 20),
    ('accessory_code', 'DEMO-SAC33', 30),
    ('accessory_code', 'DEMO-TN01', 40),
    ('accessory_name', 'Ốp silicon trong suốt', 10),
    ('accessory_name', 'Cáp sạc nhanh 20W', 20),
    ('accessory_name', 'Củ sạc 33W', 30),
    ('accessory_name', 'Tai nghe có dây 3.5', 40),
    ('accessory_price', '99000', 10),
    ('accessory_price', '150000', 20),
    ('accessory_price', '250000', 30),
    ('accessory_price', '350000', 40),
    ('accessory_cost', '45000', 10),
    ('accessory_cost', '80000', 20),
    ('accessory_cost', '120000', 30),
    ('accessory_cost', '180000', 40)
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system, is_active)
select
  c.id,
  s.id,
  'demo-' || lower(regexp_replace(l.label, '[^a-zA-Z0-9]+', '-', 'g')),
  l.label,
  l.sort_order,
  false,
  true
from labels l
join cats c on c.code = l.cat_code
cross join stores s
where not exists (
  select 1
  from public.lookup_items i
  where i.category_id = c.id
    and i.store_id = s.id
    and lower(i.label) = lower(l.label)
    and i.is_active
);

-- Seed accessories demo (store-1 + store-2) — xóa bằng code DEMO-%
with s1 as (select id from public.stores where code = 'store-1' limit 1),
s2 as (select id from public.stores where code = 'store-2' limit 1),
demo (store_code, category, brand, code, name, quantity, cost, price, status, note) as (
  values
    ('store-1', 'Ốp lưng', 'Apple', 'DEMO-OP01', 'Ốp silicon trong suốt', 25, 45000, 99000, 'in_stock', '[DEMO-SEED] Ốp iPhone — xóa sau'),
    ('store-1', 'Cáp sạc', 'Baseus', 'DEMO-CAP20', 'Cáp sạc nhanh 20W', 40, 80000, 150000, 'in_stock', '[DEMO-SEED] Cáp Type-C — xóa sau'),
    ('store-1', 'Sạc nhanh', 'Anker', 'DEMO-SAC33', 'Củ sạc 33W', 15, 120000, 250000, 'in_stock', '[DEMO-SEED] Củ sạc — xóa sau'),
    ('store-1', 'Tai nghe', 'Samsung', 'DEMO-TN01', 'Tai nghe có dây 3.5', 12, 180000, 350000, 'in_stock', '[DEMO-SEED] Tai nghe — xóa sau'),
    ('store-2', 'Cáp sạc', 'Baseus', 'DEMO-CAP20', 'Cáp sạc nhanh 20W', 18, 80000, 150000, 'in_stock', '[DEMO-SEED] Store 2 — xóa sau'),
    ('store-2', 'Ốp lưng', 'Apple', 'DEMO-OP01', 'Ốp silicon trong suốt', 10, 45000, 99000, 'out_of_stock', '[DEMO-SEED] Hết hàng demo — xóa sau')
)
insert into public.accessories (
  store_id, category, brand, code, name, quantity, cost, price, status, note
)
select
  case d.store_code
    when 'store-1' then (select id from s1)
    else (select id from s2)
  end,
  d.category,
  d.brand,
  d.code,
  d.name,
  d.quantity,
  d.cost,
  d.price,
  d.status::public.accessory_status,
  d.note
from demo d
where not exists (
  select 1
  from public.accessories a
  join public.stores st on st.id = a.store_id
  where a.code = d.code
    and st.code = d.store_code
    and a.note like '%[DEMO-SEED]%'
);
