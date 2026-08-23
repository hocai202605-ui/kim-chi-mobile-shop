-- Droplist Trạng thái máy (thêm/sửa/xóa) + lưu custom status dạng text.
-- 4 trạng thái hệ thống: Còn hàng / Đã bán / Đã hủy / Chưa xử lý.

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('phone_status', 'Trạng thái máy', 'inventory_phone', true, 85, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

insert into public.lookup_items (category_id, store_id, code, label, sort_order, is_active, is_system)
select c.id, s.id, seed.code, seed.label, seed.sort_order, true, true
from public.lookup_categories c
cross join public.stores s
cross join (
  values
    ('con-hang', 'Còn hàng', 10),
    ('da-ban', 'Đã bán', 20),
    ('chua-xu-ly', 'Chưa xử lý', 30),
    ('da-huy', 'Đã hủy', 40)
) as seed(code, label, sort_order)
where c.code = 'phone_status'
  and s.is_active = true
  and not exists (
    select 1
    from public.lookup_items i
    where i.category_id = c.id
      and i.store_id = s.id
      and (
        lower(trim(i.label)) = lower(trim(seed.label))
        or lower(trim(i.code)) = lower(trim(seed.code))
      )
  );

-- RLS phones_insert tham chiếu cột status (enum) — phải drop trước khi đổi kiểu.
drop policy if exists phones_insert on public.phones;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'phones'
      and column_name = 'status'
      and udt_name = 'phone_status'
  ) then
    alter table public.phones alter column status drop default;
    alter table public.phones
      alter column status type text
      using (
        case status::text
          when 'in_stock' then 'Còn hàng'
          when 'sold' then 'Đã bán'
          when 'pending' then 'Chưa xử lý'
          when 'cancelled' then 'Đã hủy'
          else status::text
        end
      );
    alter table public.phones alter column status set default 'Còn hàng';
    alter table public.phones alter column status set not null;
  else
    update public.phones
    set status = case status
      when 'in_stock' then 'Còn hàng'
      when 'sold' then 'Đã bán'
      when 'pending' then 'Chưa xử lý'
      when 'cancelled' then 'Đã hủy'
      else status
    end
    where status in ('in_stock', 'sold', 'pending', 'cancelled');
  end if;
end $$;

create policy phones_insert on public.phones
  for insert to authenticated
  with check (
    (public.is_owner() or store_id = public.my_store_id())
    and status not in ('Đã hủy', 'cancelled')
  );

create or replace function public.report_inventory_capital(p_store_id uuid default null)
returns table (
  phone_capital bigint,
  accessory_capital bigint,
  total_capital bigint,
  phone_count bigint,
  accessory_qty bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  include_pending boolean := false;
begin
  if p_store_id is null and not public.is_owner() then
    p_store_id := public.my_store_id();
  end if;
  if p_store_id is not null and not public.is_owner()
     and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  select (value = 'true') into include_pending
  from public.app_params
  where key = 'inventory.capital_include_pending';

  return query
  select
    coalesce((
      select sum(p.cost)::bigint from public.phones p
      where (p_store_id is null or p.store_id = p_store_id)
        and (
          p.status in ('Còn hàng', 'in_stock')
          or (include_pending and p.status in ('Chưa xử lý', 'pending'))
        )
    ), 0)::bigint as phone_capital,
    coalesce((
      select sum(a.cost * a.quantity)::bigint from public.accessories a
      where (p_store_id is null or a.store_id = p_store_id)
        and a.status <> 'cancelled'
    ), 0)::bigint as accessory_capital,
    (
      coalesce((
        select sum(p.cost)::bigint from public.phones p
        where (p_store_id is null or p.store_id = p_store_id)
          and (
            p.status in ('Còn hàng', 'in_stock')
            or (include_pending and p.status in ('Chưa xử lý', 'pending'))
          )
      ), 0)
      +
      coalesce((
        select sum(a.cost * a.quantity)::bigint from public.accessories a
        where (p_store_id is null or a.store_id = p_store_id)
          and a.status <> 'cancelled'
      ), 0)
    )::bigint as total_capital,
    coalesce((
      select count(*)::bigint from public.phones p
      where (p_store_id is null or p.store_id = p_store_id)
        and p.status in ('Còn hàng', 'in_stock')
    ), 0)::bigint as phone_count,
    coalesce((
      select sum(a.quantity)::bigint from public.accessories a
      where (p_store_id is null or a.store_id = p_store_id)
        and a.status <> 'cancelled'
    ), 0)::bigint as accessory_qty;
end;
$$;
