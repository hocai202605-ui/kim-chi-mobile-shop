-- LINH KIỆN độc lập: các trường quản lý kho không liên quan part_inbounds.
alter table public.part_catalog_items
  add column if not exists brand text not null default '',
  add column if not exists part_type text not null default '',
  add column if not exists device_type text not null default '',
  add column if not exists color text not null default '',
  add column if not exists cost_price numeric(14,2),
  add column if not exists retail_price numeric(14,2),
  add column if not exists quantity integer not null default 0;

alter table public.part_catalog_items
  drop constraint if exists part_catalog_items_quantity_nonnegative;
alter table public.part_catalog_items
  add constraint part_catalog_items_quantity_nonnegative check (quantity >= 0);

-- Catalog Excel/mock cũ không còn dùng. Xóa sạch để module mới bắt đầu độc lập.
-- Không tác động public.part_inbounds của màn Nhập hàng.
delete from public.part_catalog_items;

drop index if exists public.part_catalog_items_store_cat_brand_name_uidx;
create unique index if not exists part_catalog_items_active_business_uidx
  on public.part_catalog_items (
    store_id,
    lower(trim(brand)),
    lower(trim(part_type)),
    lower(trim(device_type)),
    lower(trim(color))
  )
  where status = 'active';

create index if not exists part_catalog_items_filters_idx
  on public.part_catalog_items (store_id, status, brand, part_type, device_type);

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('catalog_part_brand', 'Linh kiện - Hãng', 'shared', true, 440, true),
  ('catalog_part_type', 'Linh kiện - Loại linh kiện', 'shared', true, 450, true),
  ('catalog_part_retail_price', 'Linh kiện - Giá thay khách', 'shared', true, 460, true),
  ('catalog_part_cost_price', 'Linh kiện - Giá nhập', 'shared', true, 470, true),
  ('catalog_part_device_type', 'Linh kiện - Thuộc loại máy', 'shared', true, 480, true)
on conflict (code) do update set
  name = excluded.name,
  allow_user_add = true,
  is_active = true,
  updated_at = now();
