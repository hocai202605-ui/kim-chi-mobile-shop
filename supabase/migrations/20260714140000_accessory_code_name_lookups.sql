-- Accessory code/name droplists (per-store). Options only via ManageableSelect (+).

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
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
