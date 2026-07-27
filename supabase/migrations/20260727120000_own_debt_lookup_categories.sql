-- Droplist form MÌNH NỢ (per-store lookup_items): người mình nợ / loại món nợ.
-- Không seed mặc định cố định — seed từ own_debts hiện có; user thêm/sửa/xóa qua ManageableSelect.

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('own_debt_creditor', 'Người mình nợ (Mình nợ)', 'shared', true, 500, true),
  ('own_debt_type', 'Loại món nợ (Mình nợ)', 'shared', true, 510, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed theo từng CH từ khoản mình nợ đã có
with src as (
  select store_id, trim(creditor_name) as label, 'own_debt_creditor'::text as cat_code
  from public.own_debts
  where length(trim(creditor_name)) > 0
  union
  select store_id, trim(debt_type), 'own_debt_type'
  from public.own_debts
  where length(trim(debt_type)) > 0
),
dedup as (
  select distinct store_id, cat_code, label
  from src
  where length(trim(label)) > 0
)
insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_system)
select
  c.id,
  d.store_id,
  coalesce(nullif(public.slugify_label(d.label), ''), 'item-' || substr(md5(d.label), 1, 8)),
  d.label,
  10 + (row_number() over (partition by d.store_id, d.cat_code order by d.label))::int * 10,
  false
from dedup d
join public.lookup_categories c on c.code = d.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id
    and i.store_id = d.store_id
    and i.is_active
    and lower(i.label) = lower(d.label)
);
