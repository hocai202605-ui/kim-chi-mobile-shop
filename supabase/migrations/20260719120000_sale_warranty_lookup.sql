-- Droplist bảo hành trên phiếu bán máy (per-store lookup_items).

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('sale_warranty', 'Bảo hành (Bán máy)', 'shared', true, 360, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed mặc định cho mọi cửa hàng (nếu store chưa có label)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_active, is_system)
select c.id, s.id, seed.code, seed.label, seed.sort_order, true, true
from public.lookup_categories c
cross join public.stores s
cross join (
  values
    ('khong-bh', 'Không BH', 10),
    ('1-thang', '1 tháng', 20),
    ('3-thang', '3 tháng', 30),
    ('6-thang', '6 tháng', 40),
    ('12-thang', '12 tháng', 50)
) as seed(code, label, sort_order)
where c.code = 'sale_warranty'
  and s.is_active = true
  and not exists (
    select 1
    from public.lookup_items i
    where i.category_id = c.id
      and i.store_id = s.id
      and lower(trim(i.label)) = lower(trim(seed.label))
  );
