-- Accessories: category, brand, note + droplist categories (per-store).
-- Droplist only grows via ManageableSelect (+), never on save.

alter table public.accessories
  add column if not exists category text not null default '',
  add column if not exists brand text not null default '',
  add column if not exists note text not null default '';

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('accessory_category', 'Danh mục phụ kiện', 'shared', true, 300, true),
  ('accessory_brand', 'Hãng phụ kiện', 'shared', true, 310, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();
