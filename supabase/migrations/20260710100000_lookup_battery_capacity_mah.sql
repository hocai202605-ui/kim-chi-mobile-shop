-- Add common phone battery capacities (mAh) to phone_battery_capacity lookup.
-- Idempotent: insert only when active item with same code does not already exist.

with seed(cat_code, item_code, item_label, sort_order) as (
  values
    -- Common mAh — sort_order after % health (see 20260710110000 re-rank)
    ('phone_battery_capacity', '2000mah', '2000 mAh', 1000),
    ('phone_battery_capacity', '2500mah', '2500 mAh', 1010),
    ('phone_battery_capacity', '3000mah', '3000 mAh', 1020),
    ('phone_battery_capacity', '3200mah', '3200 mAh', 1030),
    ('phone_battery_capacity', '3500mah', '3500 mAh', 1040),
    ('phone_battery_capacity', '4000mah', '4000 mAh', 1050),
    ('phone_battery_capacity', '4500mah', '4500 mAh', 1060),
    ('phone_battery_capacity', '5000mah', '5000 mAh', 1070),
    ('phone_battery_capacity', '5500mah', '5500 mAh', 1080),
    ('phone_battery_capacity', '6000mah', '6000 mAh', 1090)
)
insert into public.lookup_items (category_id, code, label, sort_order, is_system)
select c.id, s.item_code, s.item_label, s.sort_order, true
from seed s
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and lower(i.code) = lower(s.item_code) and i.is_active
);
