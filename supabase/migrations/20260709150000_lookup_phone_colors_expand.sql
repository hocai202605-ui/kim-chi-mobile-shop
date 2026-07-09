-- Expand phone_color (+ a few common storage/made-in) so demo phones match dropdowns.
-- Idempotent: insert only when active item with same code does not already exist.

with seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('phone_color', 'do', 'Đỏ', 60),
    ('phone_color', 'xam', 'Xám', 70),
    ('phone_color', 'titan', 'Titan', 80),
    ('phone_color', 'xanh-duong', 'Xanh dương', 90),
    ('phone_color', 'xanh-bien', 'Xanh biển', 100),
    ('phone_color', 'hong', 'Hồng', 110),
    ('phone_color', 'bac', 'Bạc', 120),
    ('phone_storage', '1tb', '1TB', 50),
    ('phone_made_in', 'viet-nam', 'Việt Nam', 40),
    ('phone_condition', 'zin', 'Zin', 5),
    ('phone_battery_capacity', '100pct', '100%', 5),
    ('phone_battery_capacity', '99pct', '99%', 8),
    ('phone_battery_capacity', '95pct', '95%', 15),
    ('phone_battery_capacity', '85pct', '85%', 25),
    ('phone_battery_capacity', 'duoi-80', 'Dưới 80%', 40)
)
insert into public.lookup_items (category_id, code, label, sort_order, is_system)
select c.id, s.item_code, s.item_label, s.sort_order, true
from seed s
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and lower(i.code) = lower(s.item_code) and i.is_active
);
