-- Add phone color "Cam" (orange) to inventory lookup.
-- Idempotent: insert only when active item with same code does not already exist.

with seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('phone_color', 'cam', 'Cam', 55)
)
insert into public.lookup_items (category_id, code, label, sort_order, is_system)
select c.id, s.item_code, s.item_label, s.sort_order, true
from seed s
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and lower(i.code) = lower(s.item_code) and i.is_active
);
