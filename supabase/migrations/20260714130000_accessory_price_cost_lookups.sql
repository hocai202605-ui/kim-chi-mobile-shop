-- Accessory price/cost droplists (per-store). Options only via ManageableSelect (+).

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('accessory_price', 'Giá bán phụ kiện', 'shared', true, 320, true),
  ('accessory_cost', 'Giá nhập phụ kiện', 'shared', true, 330, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();
