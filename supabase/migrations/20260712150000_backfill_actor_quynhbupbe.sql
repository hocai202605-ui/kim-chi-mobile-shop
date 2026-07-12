-- Backfill: gán created_by / updated_by = 'quynhbupbe' cho mọi bản ghi hiện có.
-- Yêu cầu: cột created_by / updated_by đã là text (migration 20260712140000).

do $$
declare
  t text;
  tables text[] := array[
    'phones',
    'accessories',
    'software_orders',
    'lookup_items',
    'lookup_categories',
    'customers',
    'sales',
    'sale_items',
    'app_accounts',
    'app_params',
    'stores',
    'profiles'
  ];
  has_created boolean;
  has_updated boolean;
  n bigint;
begin
  foreach t in array tables loop
    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'created_by'
        and data_type in ('text', 'character varying')
    ) into has_created;

    select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t
        and column_name = 'updated_by'
        and data_type in ('text', 'character varying')
    ) into has_updated;

    if has_created and has_updated then
      execute format(
        'update public.%I set created_by = %L, updated_by = %L',
        t, 'quynhbupbe', 'quynhbupbe'
      );
      get diagnostics n = row_count;
      raise notice '%: set created_by+updated_by quynhbupbe → % rows', t, n;
    elsif has_created then
      execute format('update public.%I set created_by = %L', t, 'quynhbupbe');
      get diagnostics n = row_count;
      raise notice '%: set created_by quynhbupbe → % rows', t, n;
    elsif has_updated then
      execute format('update public.%I set updated_by = %L', t, 'quynhbupbe');
      get diagnostics n = row_count;
      raise notice '%: set updated_by quynhbupbe → % rows', t, n;
    else
      raise notice '%: skip (chưa có cột text created_by/updated_by — chạy 20260712140000 trước)', t;
    end if;
  end loop;

  -- cancelled_by: chỉ khi đã hủy
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'phones'
      and column_name = 'cancelled_by' and data_type in ('text', 'character varying')
  ) then
    update public.phones
    set cancelled_by = 'quynhbupbe'
    where cancelled_at is not null
       or status::text = 'cancelled';
    get diagnostics n = row_count;
    raise notice 'phones.cancelled_by → % rows', n;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'accessories'
      and column_name = 'cancelled_by' and data_type in ('text', 'character varying')
  ) then
    update public.accessories
    set cancelled_by = 'quynhbupbe'
    where cancelled_at is not null
       or status::text = 'cancelled';
    get diagnostics n = row_count;
    raise notice 'accessories.cancelled_by → % rows', n;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sales'
      and column_name = 'cancelled_by' and data_type in ('text', 'character varying')
  ) then
    update public.sales
    set cancelled_by = 'quynhbupbe'
    where cancelled_at is not null
       or status::text = 'cancelled';
    get diagnostics n = row_count;
    raise notice 'sales.cancelled_by → % rows', n;
  end if;
end $$;
