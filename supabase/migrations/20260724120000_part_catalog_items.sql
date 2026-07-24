-- Catalog LINH KIỆN (độc lập — không gắn part_inbounds / sửa / bán).
-- 1 model = 1 dòng; giá/tồn theo hạng trong jsonb grades (giống Excel nhiều cột).

create table if not exists public.part_catalog_items (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id),
  category      text not null
    check (category in ('man_android', 'man_iphone', 'pin')),
  brand_group   text not null default '',
  name          text not null,
  note          text not null default '',
  grades        jsonb not null default '{}'::jsonb,
  status        text not null default 'active'
    check (status in ('active', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    text,
  updated_by    text,
  constraint part_catalog_items_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists part_catalog_items_store_cat_brand_name_uidx
  on public.part_catalog_items (
    store_id,
    category,
    lower(trim(brand_group)),
    lower(trim(name))
  )
  where status = 'active';

create index if not exists part_catalog_items_store_id_idx
  on public.part_catalog_items (store_id);

create index if not exists part_catalog_items_category_idx
  on public.part_catalog_items (category);

create index if not exists part_catalog_items_status_idx
  on public.part_catalog_items (status);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists part_catalog_items_set_updated_at on public.part_catalog_items;
    create trigger part_catalog_items_set_updated_at
      before update on public.part_catalog_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed demo (store-1) nếu bảng trống — lấy mẫu từ Excel Kim Chi
insert into public.part_catalog_items (
  store_id, category, brand_group, name, note, grades, created_by, updated_by
)
select
  s.id,
  v.category,
  v.brand_group,
  v.name,
  v.note,
  v.grades::jsonb,
  'seed',
  'seed'
from public.stores s
cross join (
  values
    -- Màn Android · Samsung
    ('man_android', 'samsung', 'A10 - M10', '',
     '{"default":{"cost":155,"price":400,"qty":1}}'),
    ('man_android', 'samsung', 'A11 - M11', '',
     '{"default":{"cost":180,"price":450,"qty":1}}'),
    ('man_android', 'samsung', 'A13', '',
     '{"default":{"cost":180,"price":450,"qty":1}}'),
    ('man_android', 'samsung', 'A20s', '',
     '{"default":{"cost":180,"price":450,"qty":2}}'),
    -- Màn Android · Oppo-Realme
    ('man_android', 'oppo_realme', 'A3S - A5 - C1 - C2', '',
     '{"default":{"cost":145,"price":400,"qty":1}}'),
    ('man_android', 'oppo_realme', 'A5S - A7 - A12 - RM3', '',
     '{"default":{"cost":160,"price":400,"qty":1}}'),
    ('man_android', 'oppo_realme', 'F7', '',
     '{"default":{"cost":170,"price":450,"qty":2}}'),
    -- Màn Android · Xiaomi
    ('man_android', 'xiaomi_poco', 'Redmi 9 - 9A - 9C - 10A', '',
     '{"default":{"cost":160,"price":400,"qty":2}}'),
    ('man_android', 'xiaomi_poco', 'Note 7', '',
     '{"default":{"cost":185,"price":450,"qty":1}}'),
    ('man_android', 'xiaomi_poco', 'Note 13 4g (Zin)', '',
     '{"default":{"cost":null,"price":1600,"qty":0}}'),
    -- Màn iPhone
    ('man_iphone', '', '11', '',
     '{"zin":{"price":950},"lo":{"price":0},"lo_xin":{"price":null},"gx":{"price":500}}'),
    ('man_iphone', '', '11 Pro', '',
     '{"zin":{"price":0},"lo":{"price":600},"lo_xin":{"price":null},"gx":{"price":850}}'),
    ('man_iphone', '', '12 - 12 Pro', '',
     '{"zin":{"price":null},"lo":{"price":600},"lo_xin":{"price":null},"gx":{"price":1100}}'),
    ('man_iphone', '', '13 Pro', '',
     '{"zin":{"price":null},"lo":{"price":800},"lo_xin":{"price":null},"gx":{"price":1600}}'),
    ('man_iphone', '', '14 PRO', '',
     '{"zin":{"price":null},"lo":{"price":850},"lo_xin":{"price":null},"gx":{"price":2800}}'),
    ('man_iphone', '', 'X', '',
     '{"zin":{"price":1550},"lo":{"price":500},"lo_xin":{"price":null},"gx":{"price":750}}'),
    -- Pin
    ('pin', '', '11', '',
     '{"re":{"price":400},"dlc":{"price":450},"used":{"price":null},"used_dlc":{"price":null}}'),
    ('pin', '', '12 - 12 Pro', '',
     '{"re":{"price":400},"dlc":{"price":450},"used":{"price":500},"used_dlc":{"price":550}}'),
    ('pin', '', '13 Pro', '',
     '{"re":{"price":500},"dlc":{"price":550},"used":{"price":null},"used_dlc":{"price":700}}'),
    ('pin', '', '14 PRO', '',
     '{"re":{"price":600},"dlc":{"price":650},"used":{"price":null},"used_dlc":{"price":750}}'),
    ('pin', '', '15', '',
     '{"re":{"price":null},"dlc":{"price":null},"used":{"price":null},"used_dlc":{"price":700}}')
) as v(category, brand_group, name, note, grades)
where s.code = 'store-1'
  and not exists (select 1 from public.part_catalog_items limit 1);
