-- Sort phone_battery_capacity: % health first (100% → lower), then mAh (low → high).
-- Idempotent re-rank of active items in this category.

with items as (
  select
    i.id,
    i.label,
    case
      when i.label ~* 'mah' then 1
      when i.label ~ '%' or i.label ~* 'dưới|duoi' then 0
      else 2
    end as grp,
    case
      when i.label ~* 'mah' then
        coalesce((regexp_match(i.label, '(\d+)'))[1]::numeric, 0)
      when i.label ~* 'dưới|duoi' then
        -- "Dưới 80%" sits just below 80
        coalesce((regexp_match(i.label, '(\d+)'))[1]::numeric, 0) - 0.5
      when i.label ~ '%' then
        -- range "90-100%" → midpoint; single "99%" → value; negate so higher % ranks first
        -coalesce(
          (
            case
              when i.label ~ '\d+\s*[-–]\s*\d+' then
                (
                  (regexp_match(i.label, '(\d+)'))[1]::numeric
                  + (regexp_match(i.label, '[-–]\s*(\d+)'))[1]::numeric
                ) / 2
              else (regexp_match(i.label, '(\d+(?:\.\d+)?)'))[1]::numeric
            end
          ),
          0
        )
      else 0
    end as rank_key
  from public.lookup_items i
  join public.lookup_categories c on c.id = i.category_id
  where c.code = 'phone_battery_capacity'
    and i.is_active
),
ordered as (
  select
    id,
    (row_number() over (order by grp, rank_key, label) * 10)::int as new_sort
  from items
)
update public.lookup_items i
set sort_order = o.new_sort,
    updated_at = now()
from ordered o
where i.id = o.id;
