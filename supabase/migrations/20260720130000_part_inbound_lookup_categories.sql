-- Droplist form NHẬP HÀNG (per-store lookup_items): NPP / loại / hãng / màu.
-- Thêm-sửa-xóa qua ManageableSelect (+), seed từ part_inbounds hiện có.

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('part_distributor', 'Nhà phân phối (Nhập hàng)', 'shared', true, 400, true),
  ('part_type', 'Loại linh kiện (Nhập hàng)', 'shared', true, 410, true),
  ('part_brand', 'Hãng (Nhập hàng)', 'shared', true, 420, true),
  ('part_color', 'Màu sắc (Nhập hàng)', 'shared', true, 430, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed theo từng CH từ phiếu nhập đã có
with src as (
  select store_id, trim(distributor) as label, 'part_distributor'::text as cat_code
  from public.part_inbounds
  where length(trim(distributor)) > 0
  union
  select store_id, trim(part_type), 'part_type'
  from public.part_inbounds
  where length(trim(part_type)) > 0
  union
  select store_id, trim(brand), 'part_brand'
  from public.part_inbounds
  where length(trim(coalesce(brand, ''))) > 0
  union
  select store_id, trim(color), 'part_color'
  from public.part_inbounds
  where length(trim(coalesce(color, ''))) > 0
),
dedup as (
  select distinct store_id, cat_code, label
  from src
  where length(trim(label)) > 0
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
select
  c.id,
  d.store_id,
  coalesce(nullif(public.slugify_label(d.label), ''), 'item-' || substr(md5(d.label), 1, 8)),
  d.label,
  10 + (row_number() over (partition by d.store_id, d.cat_code order by d.label))::int * 10,
  false
from dedup d
join public.lookup_categories c on c.code = d.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id
    and i.store_id = d.store_id
    and i.is_active
    and lower(i.label) = lower(d.label)
);

-- Fallback mẫu store-1 nếu category còn trống (chưa có phiếu)
with s1 as (select id from public.stores where code = 'store-1' limit 1),
seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('part_distributor', 'npp-mau', 'NPP mẫu', 10),
    ('part_type', 'man-hinh', 'Màn hình', 10),
    ('part_type', 'pin', 'Pin', 20),
    ('part_brand', 'apple', 'Apple', 10),
    ('part_brand', 'samsung', 'Samsung', 20),
    ('part_color', 'den', 'Đen', 10),
    ('part_color', 'trang', 'Trắng', 20)
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
