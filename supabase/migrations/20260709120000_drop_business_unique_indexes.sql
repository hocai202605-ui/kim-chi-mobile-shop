-- Drop business unique indexes; keep only primary keys (+ system FKs).
-- App allows duplicate IMEI / accessory codes per product request.

drop index if exists public.phones_imei_uidx;
drop index if exists public.accessories_store_code_active_uidx;
drop index if exists public.sale_items_phone_active_uidx;

-- Non-unique helpers for search / list (optional, not constraints)
create index if not exists phones_imei_idx on public.phones (imei);
create index if not exists accessories_store_code_idx on public.accessories (store_id, code);

-- Document policy: IMEI is NOT unique
insert into public.app_params (key, value, value_type, description, is_public)
values (
  'inventory.imei_unique_global',
  'false',
  'boolean',
  'IMEI unique policy: false = allow duplicate IMEI',
  true
)
on conflict (key) do update
set value = excluded.value,
    description = excluded.description,
    updated_at = now();
