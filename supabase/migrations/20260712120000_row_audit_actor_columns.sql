-- Row audit: đảm bảo created_at / updated_at + actor username (app_accounts).
-- Login hiện tại dùng app_accounts (username), không phải profiles/auth.uid(),
-- nên actor lưu dạng text username để truy vết được ngay.

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Gắn trigger updated_at nếu bảng có cột updated_at và chưa có trigger
create or replace function public.ensure_updated_at_trigger(p_table text)
returns void
language plpgsql
as $$
declare
  trg text := p_table || '_set_updated_at';
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = p_table
      and column_name = 'updated_at'
  ) then
    return;
  end if;

  execute format('drop trigger if exists %I on public.%I', trg, p_table);
  execute format(
    'create trigger %I before update on public.%I
     for each row execute function public.set_updated_at()',
    trg,
    p_table
  );
end;
$$;

-- ---------- phones ----------
alter table public.phones
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- accessories ----------
alter table public.accessories
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- software_orders ----------
alter table public.software_orders
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- lookup_items ----------
alter table public.lookup_items
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- lookup_categories ----------
alter table public.lookup_categories
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- customers ----------
alter table public.customers
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- sales ----------
alter table public.sales
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- sale_items ----------
alter table public.sale_items
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- app_accounts ----------
alter table public.app_accounts
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- app_params ----------
alter table public.app_params
  add column if not exists created_at timestamptz not null default now();

-- ---------- stores / profiles: timestamps đã có; bổ sung username actor nếu cần admin seed ----------
alter table public.stores
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

alter table public.profiles
  add column if not exists created_by_username text,
  add column if not exists updated_by_username text;

-- ---------- triggers updated_at ----------
select public.ensure_updated_at_trigger('phones');
select public.ensure_updated_at_trigger('accessories');
select public.ensure_updated_at_trigger('software_orders');
select public.ensure_updated_at_trigger('lookup_items');
select public.ensure_updated_at_trigger('lookup_categories');
select public.ensure_updated_at_trigger('customers');
select public.ensure_updated_at_trigger('sales');
select public.ensure_updated_at_trigger('sale_items');
select public.ensure_updated_at_trigger('app_accounts');
select public.ensure_updated_at_trigger('stores');
select public.ensure_updated_at_trigger('profiles');
select public.ensure_updated_at_trigger('app_params');

-- ---------- indexes (lọc theo actor) ----------
create index if not exists phones_created_by_username_idx
  on public.phones (created_by_username);
create index if not exists phones_updated_by_username_idx
  on public.phones (updated_by_username);
create index if not exists accessories_created_by_username_idx
  on public.accessories (created_by_username);
create index if not exists software_orders_created_by_username_idx
  on public.software_orders (created_by_username);
create index if not exists software_orders_updated_by_username_idx
  on public.software_orders (updated_by_username);

comment on column public.phones.created_by_username is 'Username app_accounts tạo bản ghi';
comment on column public.phones.updated_by_username is 'Username app_accounts sửa gần nhất';
comment on column public.software_orders.created_by_username is 'Username app_accounts tạo đơn';
comment on column public.software_orders.updated_by_username is 'Username app_accounts sửa gần nhất';
