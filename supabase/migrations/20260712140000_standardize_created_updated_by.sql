-- Chuẩn hóa created_by / updated_by = text username (app_accounts).
-- UUID cũ (FK profiles) rename → *_profile_id để không mất cột.
-- Gộp dữ liệu từ *_username nếu đã chạy migration 20260712120000.

create or replace function public._audit_rename_uuid_to_profile_id(p_table text, p_col text)
returns void
language plpgsql
as $$
declare
  data_type text;
  new_name text := p_col || '_profile_id';
begin
  select c.data_type into data_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = p_table
    and c.column_name = p_col;

  if data_type is null then
    return;
  end if;

  -- uuid / user-defined (uuid) → rename
  if data_type in ('uuid', 'USER-DEFINED') then
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = p_table and column_name = new_name
    ) then
      execute format('alter table public.%I rename column %I to %I', p_table, p_col, new_name);
    end if;
  end if;
end;
$$;

create or replace function public._audit_ensure_text_actor(p_table text)
returns void
language plpgsql
as $$
begin
  -- created_by text
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'created_by'
  ) then
    execute format('alter table public.%I add column created_by text', p_table);
  else
    -- nếu vẫn uuid (rename chưa chạy), bỏ qua — gọi rename trước
    null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'updated_by'
  ) then
    execute format('alter table public.%I add column updated_by text', p_table);
  end if;

  -- Gộp từ *_username
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'created_by_username'
  ) then
    execute format(
      'update public.%I set created_by = coalesce(created_by, created_by_username)
       where created_by is null and created_by_username is not null',
      p_table
    );
    execute format('alter table public.%I drop column if exists created_by_username', p_table);
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = p_table and column_name = 'updated_by_username'
  ) then
    execute format(
      'update public.%I set updated_by = coalesce(updated_by, updated_by_username)
       where updated_by is null and updated_by_username is not null',
      p_table
    );
    execute format('alter table public.%I drop column if exists updated_by_username', p_table);
  end if;
end;
$$;

-- 1) Rename UUID actor → *_profile_id (nếu còn)
select public._audit_rename_uuid_to_profile_id('phones', 'created_by');
select public._audit_rename_uuid_to_profile_id('phones', 'updated_by');
select public._audit_rename_uuid_to_profile_id('accessories', 'created_by');
select public._audit_rename_uuid_to_profile_id('accessories', 'updated_by');
select public._audit_rename_uuid_to_profile_id('sales', 'created_by');
select public._audit_rename_uuid_to_profile_id('sales', 'updated_by');
select public._audit_rename_uuid_to_profile_id('lookup_items', 'created_by');
select public._audit_rename_uuid_to_profile_id('lookup_items', 'updated_by');
select public._audit_rename_uuid_to_profile_id('app_params', 'created_by');
select public._audit_rename_uuid_to_profile_id('app_params', 'updated_by');
select public._audit_rename_uuid_to_profile_id('software_orders', 'created_by');
select public._audit_rename_uuid_to_profile_id('software_orders', 'updated_by');
select public._audit_rename_uuid_to_profile_id('customers', 'created_by');
select public._audit_rename_uuid_to_profile_id('customers', 'updated_by');
select public._audit_rename_uuid_to_profile_id('sale_items', 'created_by');
select public._audit_rename_uuid_to_profile_id('sale_items', 'updated_by');
select public._audit_rename_uuid_to_profile_id('app_accounts', 'created_by');
select public._audit_rename_uuid_to_profile_id('app_accounts', 'updated_by');
select public._audit_rename_uuid_to_profile_id('stores', 'created_by');
select public._audit_rename_uuid_to_profile_id('stores', 'updated_by');
select public._audit_rename_uuid_to_profile_id('lookup_categories', 'created_by');
select public._audit_rename_uuid_to_profile_id('lookup_categories', 'updated_by');
select public._audit_rename_uuid_to_profile_id('profiles', 'created_by');
select public._audit_rename_uuid_to_profile_id('profiles', 'updated_by');

-- 2) Ensure text created_by / updated_by + merge *_username
select public._audit_ensure_text_actor('phones');
select public._audit_ensure_text_actor('accessories');
select public._audit_ensure_text_actor('software_orders');
select public._audit_ensure_text_actor('lookup_items');
select public._audit_ensure_text_actor('lookup_categories');
select public._audit_ensure_text_actor('customers');
select public._audit_ensure_text_actor('sales');
select public._audit_ensure_text_actor('sale_items');
select public._audit_ensure_text_actor('app_accounts');
select public._audit_ensure_text_actor('app_params');
select public._audit_ensure_text_actor('stores');
select public._audit_ensure_text_actor('profiles');

-- 3) cancelled_by text (username); UUID cũ → cancelled_by_profile_id
select public._audit_rename_uuid_to_profile_id('phones', 'cancelled_by');
select public._audit_rename_uuid_to_profile_id('accessories', 'cancelled_by');
select public._audit_rename_uuid_to_profile_id('sales', 'cancelled_by');
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'phones' and column_name = 'cancelled_by'
  ) then
    alter table public.phones add column cancelled_by text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accessories' and column_name = 'cancelled_by'
  ) then
    alter table public.accessories add column cancelled_by text;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales' and column_name = 'cancelled_by'
  ) then
    alter table public.sales add column cancelled_by text;
  end if;
end $$;

-- 4) Indexes
create index if not exists phones_created_by_idx on public.phones (created_by);
create index if not exists phones_updated_by_idx on public.phones (updated_by);
create index if not exists accessories_created_by_idx on public.accessories (created_by);
create index if not exists software_orders_created_by_idx on public.software_orders (created_by);
create index if not exists software_orders_updated_by_idx on public.software_orders (updated_by);
create index if not exists sales_created_by_idx on public.sales (created_by);
create index if not exists lookup_items_created_by_idx on public.lookup_items (created_by);

comment on column public.phones.created_by is 'Username app_accounts tạo bản ghi';
comment on column public.phones.updated_by is 'Username app_accounts sửa gần nhất';
comment on column public.software_orders.created_by is 'Username app_accounts tạo đơn';
comment on column public.software_orders.updated_by is 'Username app_accounts sửa gần nhất';

-- cleanup helpers (optional keep for re-run safety — drop to reduce clutter)
drop function if exists public._audit_rename_uuid_to_profile_id(text, text);
drop function if exists public._audit_ensure_text_actor(text);
