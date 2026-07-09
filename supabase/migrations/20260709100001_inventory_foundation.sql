-- =============================================================================
-- Kim Chi Mobile Shop — Inventory + Reports foundation
-- Scope: stores, profiles helpers, app_params, lookup_*, phones, accessories,
--        customers, sales thin, sale_items, audit_logs, RPCs, seed
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type public.app_role as enum ('owner', 'staff');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.param_value_type as enum ('text', 'number', 'boolean', 'json');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lookup_scope as enum (
    'shared', 'inventory_phone', 'inventory_accessory', 'report'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.phone_status as enum (
    'in_stock', 'sold', 'pending', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.accessory_status as enum (
    'in_stock', 'out_of_stock', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sale_status as enum ('completed', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.sale_item_type as enum ('phone', 'accessory');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum (
    'cash', 'transfer', 'card', 'other'
  );
exception when duplicate_object then null;
end $$;

-- ---------- STORES ----------
create table if not exists public.stores (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint stores_code_format check (code ~ '^store-[0-9]+$')
);
alter table public.stores enable row level security;

-- ---------- PROFILES ----------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        public.app_role not null default 'staff',
  store_id    uuid not null references public.stores (id),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;

create index if not exists profiles_store_id_idx on public.profiles (store_id);
create index if not exists profiles_role_idx on public.profiles (role);

-- ---------- APP PARAMS ----------
create table if not exists public.app_params (
  key          text primary key,
  value        text not null,
  value_type   public.param_value_type not null default 'text',
  description  text not null default '',
  is_public    boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references public.profiles (id)
);
alter table public.app_params enable row level security;

-- ---------- LOOKUP CATEGORIES / ITEMS ----------
create table if not exists public.lookup_categories (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique,
  name            text not null,
  scope           public.lookup_scope not null default 'shared',
  allow_user_add  boolean not null default true,
  sort_order      integer not null default 0,
  is_active       boolean not null default true,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.lookup_categories enable row level security;

create table if not exists public.lookup_items (
  id           uuid primary key default gen_random_uuid(),
  category_id  uuid not null references public.lookup_categories (id) on delete cascade,
  code         text not null,
  label        text not null,
  sort_order   integer not null default 0,
  is_active    boolean not null default true,
  is_system    boolean not null default false,
  meta         jsonb not null default '{}'::jsonb,
  created_by   uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint lookup_items_code_nonempty check (length(trim(code)) > 0),
  constraint lookup_items_label_nonempty check (length(trim(label)) > 0)
);
alter table public.lookup_items enable row level security;

create unique index if not exists lookup_items_category_code_active_uidx
  on public.lookup_items (category_id, lower(code))
  where is_active;

create index if not exists lookup_items_category_id_idx
  on public.lookup_items (category_id);

-- ---------- CUSTOMERS (thin) ----------
create table if not exists public.customers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null default '',
  note        text not null default '',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.customers enable row level security;

create index if not exists customers_phone_idx on public.customers (phone);

-- ---------- PHONES ----------
create table if not exists public.phones (
  id                 uuid primary key default gen_random_uuid(),
  store_id           uuid not null references public.stores (id),
  brand              text not null,
  model_name         text not null,
  imei               text not null,
  color              text not null default '',
  storage            text not null default '',
  made_in            text not null default '',
  network_version    text not null default '',
  battery_condition  text not null default '',
  battery_capacity   text not null default '',
  condition          text not null default '',
  note               text not null default '',
  import_date        date,
  sale_date          date,
  cost               bigint not null check (cost >= 0),
  expected_price     bigint not null check (expected_price >= 0),
  status             public.phone_status not null default 'in_stock',
  created_by         uuid references public.profiles (id),
  updated_by         uuid references public.profiles (id),
  cancelled_at       timestamptz,
  cancelled_by       uuid references public.profiles (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint phones_imei_nonempty check (length(trim(imei)) > 0)
);
alter table public.phones enable row level security;

-- IMEI is NOT unique (only PK is unique). Non-unique index for search.
create index if not exists phones_imei_idx on public.phones (imei);
create index if not exists phones_store_status_idx on public.phones (store_id, status);
create index if not exists phones_brand_idx on public.phones (brand);
create index if not exists phones_expected_price_idx on public.phones (expected_price);
create index if not exists phones_import_date_idx on public.phones (import_date);
create index if not exists phones_model_name_lower_idx on public.phones (lower(model_name));

-- ---------- ACCESSORIES ----------
create table if not exists public.accessories (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores (id),
  code         text not null,
  name         text not null,
  quantity     integer not null default 0 check (quantity >= 0),
  cost         bigint not null check (cost >= 0),
  price        bigint not null check (price >= 0),
  status       public.accessory_status not null default 'in_stock',
  created_by   uuid references public.profiles (id),
  updated_by   uuid references public.profiles (id),
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint accessories_code_nonempty check (length(trim(code)) > 0)
);
alter table public.accessories enable row level security;

-- Accessory code is NOT unique (only PK). Non-unique index for search.
create index if not exists accessories_store_code_idx
  on public.accessories (store_id, code);

create index if not exists accessories_store_status_idx
  on public.accessories (store_id, status);
create index if not exists accessories_price_idx on public.accessories (price);
create index if not exists accessories_name_lower_idx on public.accessories (lower(name));

-- ---------- SALES ----------
create table if not exists public.sales (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id),
  customer_id     uuid not null references public.customers (id),
  sold_at         date not null default (timezone('Asia/Ho_Chi_Minh', now()))::date,
  sold_at_ts      timestamptz not null default now(),
  payment_method  public.payment_method not null default 'cash',
  status          public.sale_status not null default 'completed',
  total_amount    bigint not null default 0 check (total_amount >= 0),
  total_cost      bigint not null default 0 check (total_cost >= 0),
  total_profit    bigint not null default 0,
  note            text not null default '',
  created_by      uuid references public.profiles (id),
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table public.sales enable row level security;

create index if not exists sales_store_status_sold_at_idx
  on public.sales (store_id, status, sold_at);
create index if not exists sales_sold_at_idx on public.sales (sold_at);
create index if not exists sales_customer_id_idx on public.sales (customer_id);

-- ---------- SALE ITEMS ----------
create table if not exists public.sale_items (
  id             uuid primary key default gen_random_uuid(),
  sale_id        uuid not null references public.sales (id) on delete restrict,
  sale_status    public.sale_status not null default 'completed',
  item_type      public.sale_item_type not null,
  phone_id       uuid references public.phones (id),
  accessory_id   uuid references public.accessories (id),
  item_name      text not null,
  quantity       integer not null check (quantity > 0),
  unit_cost      bigint not null check (unit_cost >= 0),
  unit_price     bigint not null check (unit_price >= 0),
  amount         bigint not null check (amount >= 0),
  profit         bigint not null,
  created_at     timestamptz not null default now(),
  constraint sale_items_phone_shape check (
    (item_type = 'phone' and phone_id is not null and accessory_id is null and quantity = 1)
    or
    (item_type = 'accessory' and accessory_id is not null and phone_id is null)
  )
);
alter table public.sale_items enable row level security;

create index if not exists sale_items_sale_id_idx on public.sale_items (sale_id);
create index if not exists sale_items_phone_id_idx
  on public.sale_items (phone_id) where phone_id is not null;
create index if not exists sale_items_accessory_id_idx
  on public.sale_items (accessory_id) where accessory_id is not null;

-- No unique on sale_items.phone_id (only PK). App allows re-link / duplicate IMEI stock.

-- ---------- AUDIT LOGS ----------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  actor_id     uuid references public.profiles (id),
  actor_name   text not null default '',
  store_id     uuid references public.stores (id),
  action       text not null,
  target       text not null default '',
  meta         jsonb not null default '{}'::jsonb
);
alter table public.audit_logs enable row level security;

create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_store_id_idx on public.audit_logs (store_id);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);

-- =============================================================================
-- HELPERS
-- =============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists lookup_categories_set_updated_at on public.lookup_categories;
create trigger lookup_categories_set_updated_at
  before update on public.lookup_categories
  for each row execute function public.set_updated_at();

drop trigger if exists lookup_items_set_updated_at on public.lookup_items;
create trigger lookup_items_set_updated_at
  before update on public.lookup_items
  for each row execute function public.set_updated_at();

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists phones_set_updated_at on public.phones;
create trigger phones_set_updated_at
  before update on public.phones
  for each row execute function public.set_updated_at();

drop trigger if exists accessories_set_updated_at on public.accessories;
create trigger accessories_set_updated_at
  before update on public.accessories
  for each row execute function public.set_updated_at();

drop trigger if exists sales_set_updated_at on public.sales;
create trigger sales_set_updated_at
  before update on public.sales
  for each row execute function public.set_updated_at();

-- Accessory status sync from quantity (unless cancelled)
create or replace function public.sync_accessory_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;
  if new.quantity <= 0 then
    new.status = 'out_of_stock';
    new.quantity = 0;
  else
    new.status = 'in_stock';
  end if;
  return new;
end;
$$;

drop trigger if exists accessories_sync_status on public.accessories;
create trigger accessories_sync_status
  before insert or update of quantity, status on public.accessories
  for each row execute function public.sync_accessory_status();

-- RLS helpers
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'owner' and p.is_active
  );
$$;

create or replace function public.my_store_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.store_id from public.profiles p
  where p.id = auth.uid() and p.is_active
  limit 1;
$$;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.my_store_id() to authenticated;

-- Profile privileged field guard (service role / null auth.uid can bootstrap)
create or replace function public.guard_profile_privileged_fields()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if public.is_owner() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.store_id is distinct from old.store_id
     or new.is_active is distinct from old.is_active then
    raise exception 'profile_privileged_fields';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged on public.profiles;
create trigger profiles_guard_privileged
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_fields();

-- Auth → profile bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  default_store uuid;
begin
  select id into default_store from public.stores where code = 'store-1' limit 1;
  if default_store is null then
    return new;
  end if;

  insert into public.profiles (id, email, full_name, role, store_id)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, 'user'), '@', 1)),
    'staff',
    default_store
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Status guards disabled: app may set phone/accessory status via plain SQL.
-- (Historical RPC-only guards lived here; see migration 20260709130000.)
create or replace function public.guard_phone_status()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

create or replace function public.guard_accessory_status()
returns trigger
language plpgsql
as $$
begin
  return new;
end;
$$;

drop trigger if exists phones_guard_status on public.phones;
drop trigger if exists accessories_guard_status on public.accessories;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

-- STORES
drop policy if exists stores_select_authenticated on public.stores;
create policy stores_select_authenticated on public.stores
  for select to authenticated
  using (true);

-- PROFILES
drop policy if exists profiles_select_authenticated on public.profiles;
create policy profiles_select_authenticated on public.profiles
  for select to authenticated
  using (public.is_owner() or id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_owner())
  with check (id = auth.uid() or public.is_owner());

-- APP PARAMS
drop policy if exists app_params_select on public.app_params;
create policy app_params_select on public.app_params
  for select to authenticated
  using (is_public or public.is_owner());

drop policy if exists app_params_owner_write on public.app_params;
create policy app_params_owner_write on public.app_params
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- LOOKUP
drop policy if exists lookup_categories_select on public.lookup_categories;
create policy lookup_categories_select on public.lookup_categories
  for select to authenticated
  using (is_active or public.is_owner());

drop policy if exists lookup_categories_owner_write on public.lookup_categories;
create policy lookup_categories_owner_write on public.lookup_categories
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists lookup_items_select on public.lookup_items;
create policy lookup_items_select on public.lookup_items
  for select to authenticated
  using (is_active or public.is_owner());

drop policy if exists lookup_items_insert on public.lookup_items;
create policy lookup_items_insert on public.lookup_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.lookup_categories c
      where c.id = category_id and c.is_active and c.allow_user_add
    )
  );

drop policy if exists lookup_items_update on public.lookup_items;
create policy lookup_items_update on public.lookup_items
  for update to authenticated
  using (public.is_owner() or created_by = auth.uid())
  with check (public.is_owner() or created_by = auth.uid());

-- CUSTOMERS
drop policy if exists customers_select on public.customers;
create policy customers_select on public.customers
  for select to authenticated using (true);

drop policy if exists customers_write on public.customers;
create policy customers_write on public.customers
  for all to authenticated
  using (true)
  with check (true);

-- PHONES
drop policy if exists phones_select on public.phones;
create policy phones_select on public.phones
  for select to authenticated
  using (public.is_owner() or store_id = public.my_store_id());

drop policy if exists phones_insert on public.phones;
create policy phones_insert on public.phones
  for insert to authenticated
  with check (
    (public.is_owner() or store_id = public.my_store_id())
    and status in ('in_stock', 'pending')
  );

drop policy if exists phones_update on public.phones;
create policy phones_update on public.phones
  for update to authenticated
  using (public.is_owner() or store_id = public.my_store_id())
  with check (public.is_owner() or store_id = public.my_store_id());

-- ACCESSORIES
drop policy if exists accessories_select on public.accessories;
create policy accessories_select on public.accessories
  for select to authenticated
  using (public.is_owner() or store_id = public.my_store_id());

drop policy if exists accessories_insert on public.accessories;
create policy accessories_insert on public.accessories
  for insert to authenticated
  with check (
    (public.is_owner() or store_id = public.my_store_id())
    and status <> 'cancelled'
  );

drop policy if exists accessories_update on public.accessories;
create policy accessories_update on public.accessories
  for update to authenticated
  using (public.is_owner() or store_id = public.my_store_id())
  with check (public.is_owner() or store_id = public.my_store_id());

-- SALES
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated
  using (public.is_owner() or store_id = public.my_store_id());

-- no direct insert/update for sales — use RPCs

drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items
  for select to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_id
        and (public.is_owner() or s.store_id = public.my_store_id())
    )
  );

-- AUDIT
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (public.is_owner() or store_id = public.my_store_id() or actor_id = auth.uid());

drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs
  for insert to authenticated
  with check (actor_id = auth.uid() or public.is_owner());

-- =============================================================================
-- LOOKUP RPCs
-- =============================================================================

create or replace function public.slugify_label(p_label text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(trim(p_label)), '[^a-z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]+', '-', 'gi'));
$$;

create or replace function public.lookup_list(p_category_code text)
returns setof public.lookup_items
language sql
stable
security definer
set search_path = public
as $$
  select i.*
  from public.lookup_items i
  join public.lookup_categories c on c.id = i.category_id
  where c.code = p_category_code
    and c.is_active
    and i.is_active
  order by i.sort_order, i.label;
$$;

grant execute on function public.lookup_list(text) to authenticated;

create or replace function public.lookup_item_add(p_category_code text, p_label text)
returns public.lookup_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cat public.lookup_categories;
  v_code text;
  v_item public.lookup_items;
  v_actor text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_cat from public.lookup_categories
  where code = p_category_code and is_active
  for update;
  if not found then
    raise exception 'lookup_category_not_found';
  end if;
  if not v_cat.allow_user_add and not public.is_owner() then
    raise exception 'lookup_add_not_allowed';
  end if;

  v_code := public.slugify_label(p_label);
  if v_code is null or v_code = '' then
    v_code := 'item-' || substr(gen_random_uuid()::text, 1, 8);
  end if;

  -- reactivate inactive same code
  select * into v_item from public.lookup_items
  where category_id = v_cat.id and lower(code) = lower(v_code) and not is_active
  limit 1;

  if found then
    update public.lookup_items
    set is_active = true,
        label = trim(p_label),
        updated_at = now()
    where id = v_item.id
    returning * into v_item;
  else
    insert into public.lookup_items (category_id, code, label, created_by)
    values (v_cat.id, v_code, trim(p_label), auth.uid())
    returning * into v_item;
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, target, meta)
  values (
    auth.uid(),
    coalesce(v_actor, ''),
    'lookup_item_add',
    p_category_code || ':' || v_item.code,
    jsonb_build_object('label', v_item.label, 'id', v_item.id)
  );

  return v_item;
end;
$$;

grant execute on function public.lookup_item_add(text, text) to authenticated;

create or replace function public.lookup_item_update(
  p_id uuid,
  p_label text default null,
  p_sort_order integer default null
)
returns public.lookup_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.lookup_items;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_item from public.lookup_items where id = p_id for update;
  if not found then
    raise exception 'lookup_item_not_found';
  end if;

  if not public.is_owner() and v_item.created_by is distinct from auth.uid() then
    raise exception 'lookup_item_update_forbidden';
  end if;

  update public.lookup_items
  set label = coalesce(nullif(trim(p_label), ''), label),
      sort_order = coalesce(p_sort_order, sort_order),
      updated_at = now()
  where id = p_id
  returning * into v_item;

  return v_item;
end;
$$;

grant execute on function public.lookup_item_update(uuid, text, integer) to authenticated;

create or replace function public.lookup_item_deactivate(p_id uuid)
returns public.lookup_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item public.lookup_items;
  v_actor text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  update public.lookup_items
  set is_active = false, updated_at = now()
  where id = p_id
  returning * into v_item;

  if not found then
    raise exception 'lookup_item_not_found';
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, action, target)
  values (auth.uid(), coalesce(v_actor, ''), 'lookup_item_deactivate', v_item.code);

  return v_item;
end;
$$;

grant execute on function public.lookup_item_deactivate(uuid) to authenticated;

-- =============================================================================
-- INVENTORY CANCEL / RESTORE
-- =============================================================================

create or replace function public.cancel_phone(p_id uuid)
returns public.phones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.phones;
  v_actor text;
begin
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  update public.phones
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id and status <> 'cancelled'
  returning * into v_row;

  if not found then
    raise exception 'phone_not_found_or_cancelled';
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, store_id, action, target)
  values (auth.uid(), coalesce(v_actor, ''), v_row.store_id, 'cancel_phone', v_row.imei);

  return v_row;
end;
$$;

grant execute on function public.cancel_phone(uuid) to authenticated;

create or replace function public.restore_phone(p_id uuid)
returns public.phones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.phones;
begin
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  update public.phones
  set status = 'in_stock',
      cancelled_at = null,
      cancelled_by = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id and status = 'cancelled'
  returning * into v_row;

  if not found then
    raise exception 'phone_not_cancelled';
  end if;

  return v_row;
end;
$$;

grant execute on function public.restore_phone(uuid) to authenticated;

create or replace function public.cancel_accessory(p_id uuid)
returns public.accessories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.accessories;
  v_actor text;
begin
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  update public.accessories
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id and status <> 'cancelled'
  returning * into v_row;

  if not found then
    raise exception 'accessory_not_found_or_cancelled';
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, store_id, action, target)
  values (auth.uid(), coalesce(v_actor, ''), v_row.store_id, 'cancel_accessory', v_row.code);

  return v_row;
end;
$$;

grant execute on function public.cancel_accessory(uuid) to authenticated;

create or replace function public.restore_accessory(p_id uuid)
returns public.accessories
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.accessories;
  v_conflict boolean;
begin
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  select * into v_row from public.accessories where id = p_id for update;
  if not found or v_row.status <> 'cancelled' then
    raise exception 'accessory_not_cancelled';
  end if;

  select exists (
    select 1 from public.accessories a
    where a.store_id = v_row.store_id
      and a.code = v_row.code
      and a.id <> v_row.id
      and a.status <> 'cancelled'
  ) into v_conflict;

  if v_conflict then
    raise exception 'accessory_code_conflict';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  update public.accessories
  set status = case when quantity > 0 then 'in_stock'::public.accessory_status else 'out_of_stock'::public.accessory_status end,
      cancelled_at = null,
      cancelled_by = null,
      updated_by = auth.uid(),
      updated_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.restore_accessory(uuid) to authenticated;

-- =============================================================================
-- SALE RPCs
-- =============================================================================

create or replace function public.create_sale(
  p_store_id uuid,
  p_customer_id uuid,
  p_payment_method public.payment_method,
  p_item_type public.sale_item_type,
  p_phone_id uuid default null,
  p_accessory_id uuid default null,
  p_quantity integer default 1,
  p_unit_price bigint default 0,
  p_note text default ''
)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_phone public.phones;
  v_acc public.accessories;
  v_name text;
  v_cost bigint;
  v_amount bigint;
  v_profit bigint;
  v_qty integer;
  v_actor text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_owner() and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.is_active) then
    raise exception 'customer_inactive';
  end if;

  if p_unit_price < 0 then
    raise exception 'invalid_unit_price';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  if p_item_type = 'phone' then
    if p_phone_id is null then
      raise exception 'phone_id_required';
    end if;
    select * into v_phone from public.phones where id = p_phone_id for update;
    if not found then
      raise exception 'phone_not_found';
    end if;
    if v_phone.status <> 'in_stock' then
      raise exception 'phone_not_in_stock';
    end if;
    if v_phone.store_id is distinct from p_store_id then
      raise exception 'phone_store_mismatch';
    end if;

    v_name := v_phone.brand || ' ' || v_phone.model_name;
    v_cost := v_phone.cost;
    v_qty := 1;
    v_amount := p_unit_price;
    v_profit := p_unit_price - v_cost;

    insert into public.sales (
      store_id, customer_id, payment_method, status,
      total_amount, total_cost, total_profit, note, created_by
    ) values (
      p_store_id, p_customer_id, p_payment_method, 'completed',
      v_amount, v_cost, v_profit, coalesce(p_note, ''), auth.uid()
    ) returning * into v_sale;

    insert into public.sale_items (
      sale_id, sale_status, item_type, phone_id, item_name,
      quantity, unit_cost, unit_price, amount, profit
    ) values (
      v_sale.id, 'completed', 'phone', v_phone.id, v_name,
      1, v_cost, p_unit_price, v_amount, v_profit
    );

    update public.phones
    set status = 'sold',
        sale_date = v_sale.sold_at,
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_phone.id;

  else
    if p_accessory_id is null then
      raise exception 'accessory_id_required';
    end if;
    v_qty := coalesce(p_quantity, 1);
    if v_qty < 1 then
      raise exception 'invalid_quantity';
    end if;

    select * into v_acc from public.accessories where id = p_accessory_id for update;
    if not found or v_acc.status = 'cancelled' then
      raise exception 'accessory_not_found';
    end if;
    if v_acc.store_id is distinct from p_store_id then
      raise exception 'accessory_store_mismatch';
    end if;
    if v_acc.quantity < v_qty then
      raise exception 'insufficient_stock';
    end if;

    v_name := v_acc.name;
    v_cost := v_acc.cost * v_qty;
    v_amount := p_unit_price * v_qty;
    v_profit := v_amount - v_cost;

    insert into public.sales (
      store_id, customer_id, payment_method, status,
      total_amount, total_cost, total_profit, note, created_by
    ) values (
      p_store_id, p_customer_id, p_payment_method, 'completed',
      v_amount, v_cost, v_profit, coalesce(p_note, ''), auth.uid()
    ) returning * into v_sale;

    insert into public.sale_items (
      sale_id, sale_status, item_type, accessory_id, item_name,
      quantity, unit_cost, unit_price, amount, profit
    ) values (
      v_sale.id, 'completed', 'accessory', v_acc.id, v_name,
      v_qty, v_acc.cost, p_unit_price, v_amount, v_profit
    );

    update public.accessories
    set quantity = quantity - v_qty,
        updated_by = auth.uid(),
        updated_at = now()
    where id = v_acc.id;
  end if;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, store_id, action, target, meta)
  values (
    auth.uid(), coalesce(v_actor, ''), p_store_id, 'create_sale', v_sale.id::text,
    jsonb_build_object('amount', v_sale.total_amount, 'type', p_item_type)
  );

  return v_sale;
end;
$$;

grant execute on function public.create_sale(
  uuid, uuid, public.payment_method, public.sale_item_type,
  uuid, uuid, integer, bigint, text
) to authenticated;

create or replace function public.cancel_sale(p_sale_id uuid)
returns public.sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale public.sales;
  v_item record;
  v_actor text;
begin
  if not public.is_owner() then
    raise exception 'owner_only';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'sale_not_found';
  end if;
  if v_sale.status = 'cancelled' then
    raise exception 'sale_already_cancelled';
  end if;

  perform set_config('app.skip_status_guard', 'on', true);

  for v_item in
    select * from public.sale_items where sale_id = p_sale_id and sale_status = 'completed'
  loop
    if v_item.item_type = 'phone' then
      update public.phones
      set status = 'in_stock',
          sale_date = null,
          updated_by = auth.uid(),
          updated_at = now()
      where id = v_item.phone_id and status = 'sold';
      if not found then
        raise exception 'cancel_sale_phone_inconsistent';
      end if;
    else
      update public.accessories
      set quantity = quantity + v_item.quantity,
          updated_by = auth.uid(),
          updated_at = now()
      where id = v_item.accessory_id and status <> 'cancelled';
      -- if accessory cancelled, still try restore qty on cancelled row
      if not found then
        update public.accessories
        set quantity = quantity + v_item.quantity,
            updated_by = auth.uid(),
            updated_at = now()
        where id = v_item.accessory_id;
      end if;
    end if;

    update public.sale_items
    set sale_status = 'cancelled'
    where id = v_item.id;
  end loop;

  update public.sales
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      updated_at = now()
  where id = p_sale_id
  returning * into v_sale;

  select full_name into v_actor from public.profiles where id = auth.uid();
  insert into public.audit_logs (actor_id, actor_name, store_id, action, target)
  values (auth.uid(), coalesce(v_actor, ''), v_sale.store_id, 'cancel_sale', p_sale_id::text);

  return v_sale;
end;
$$;

grant execute on function public.cancel_sale(uuid) to authenticated;

-- =============================================================================
-- REPORT RPCs
-- =============================================================================

create or replace function public.report_inventory_monthly(
  p_year_month text,
  p_store_id uuid default null
)
returns table (
  sold_phones bigint,
  revenue bigint,
  profit bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_store_id is null and not public.is_owner() then
    p_store_id := public.my_store_id();
  end if;
  if p_store_id is not null and not public.is_owner()
     and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  return query
  select
    coalesce(sum(case when si.item_type = 'phone' then si.quantity else 0 end), 0)::bigint as sold_phones,
    coalesce(sum(s.total_amount), 0)::bigint as revenue,
    coalesce(sum(s.total_profit), 0)::bigint as profit
  from public.sales s
  left join public.sale_items si on si.sale_id = s.id and si.sale_status = 'completed'
  where s.status = 'completed'
    and to_char(s.sold_at, 'YYYY-MM') = p_year_month
    and (p_store_id is null or s.store_id = p_store_id);
end;
$$;

grant execute on function public.report_inventory_monthly(text, uuid) to authenticated;

create or replace function public.report_inventory_yearly(
  p_year integer,
  p_store_id uuid default null
)
returns table (
  month integer,
  revenue bigint,
  profit bigint,
  sold bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_store_id is null and not public.is_owner() then
    p_store_id := public.my_store_id();
  end if;
  if p_store_id is not null and not public.is_owner()
     and p_store_id is distinct from public.my_store_id() then
    raise exception 'store_forbidden';
  end if;

  return query
  with months as (
    select generate_series(1, 12) as month
  ),
  agg as (
    select
      extract(month from s.sold_at)::int as month,
      coalesce(sum(s.total_amount), 0)::bigint as revenue,
      coalesce(sum(s.total_profit), 0)::bigint as profit,
      coalesce(sum(case when si.item_type = 'phone' then si.quantity else 0 end), 0)::bigint as sold
    from public.sales s
    left join public.sale_items si on si.sale_id = s.id and si.sale_status = 'completed'
    where s.status = 'completed'
      and extract(year from s.sold_at) = p_year
      and (p_store_id is null or s.store_id = p_store_id)
    group by 1
  )
  select
    m.month,
    coalesce(a.revenue, 0)::bigint,
    coalesce(a.profit, 0)::bigint,
    coalesce(a.sold, 0)::bigint
  from months m
  left join agg a on a.month = m.month
  order by m.month;
end;
$$;

grant execute on function public.report_inventory_yearly(integer, uuid) to authenticated;

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
          p.status = 'in_stock'
          or (include_pending and p.status = 'pending')
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
            p.status = 'in_stock'
            or (include_pending and p.status = 'pending')
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
        and p.status = 'in_stock'
    ), 0)::bigint as phone_count,
    coalesce((
      select sum(a.quantity)::bigint from public.accessories a
      where (p_store_id is null or a.store_id = p_store_id)
        and a.status <> 'cancelled'
    ), 0)::bigint as accessory_qty;
end;
$$;

grant execute on function public.report_inventory_capital(uuid) to authenticated;

-- =============================================================================
-- SEED
-- =============================================================================

insert into public.stores (code, name)
values
  ('store-1', 'Cửa hàng 1'),
  ('store-2', 'Cửa hàng 2'),
  ('store-3', 'Cửa hàng 3')
on conflict (code) do update set name = excluded.name, is_active = true;

insert into public.app_params (key, value, value_type, description, is_public)
values
  ('inventory.phone_list_page_size', '10', 'number', 'Pagination size for inventory list', true),
  ('inventory.capital_include_pending', 'false', 'boolean', 'Include pending phones in capital', true),
  ('inventory.imei_unique_global', 'false', 'boolean', 'IMEI unique policy: false = allow duplicate IMEI', true),
  ('report.timezone', 'Asia/Ho_Chi_Minh', 'text', 'Business timezone for reports', true)
on conflict (key) do update
  set value = excluded.value,
      value_type = excluded.value_type,
      description = excluded.description,
      is_public = excluded.is_public,
      updated_at = now();

insert into public.lookup_categories (code, name, scope, allow_user_add, sort_order, is_system)
values
  ('phone_brand', 'Hãng máy', 'inventory_phone', true, 10, true),
  ('phone_model_name', 'Tên máy', 'inventory_phone', true, 20, true),
  ('phone_color', 'Màu sắc', 'inventory_phone', true, 30, true),
  ('phone_storage', 'Dung lượng máy', 'inventory_phone', true, 40, true),
  ('phone_made_in', 'Quốc gia', 'inventory_phone', true, 50, true),
  ('phone_condition', 'Tình trạng máy', 'inventory_phone', true, 60, true),
  ('phone_battery_condition', 'Tình trạng pin', 'inventory_phone', true, 70, true),
  ('phone_battery_capacity', 'Dung lượng pin', 'inventory_phone', true, 80, true),
  ('accessory_code_prefix', 'Nhóm mã phụ kiện', 'inventory_accessory', true, 90, true)
on conflict (code) do update
  set name = excluded.name,
      scope = excluded.scope,
      allow_user_add = excluded.allow_user_add,
      sort_order = excluded.sort_order,
      is_system = true,
      is_active = true,
      updated_at = now();

-- Seed lookup items (reactivate-safe: insert if not exists by category+code)
with seed(cat_code, item_code, item_label, sort_order) as (
  values
    ('phone_brand', 'iphone', 'iPhone', 10),
    ('phone_brand', 'samsung', 'Samsung', 20),
    ('phone_brand', 'oppo', 'Oppo', 30),
    ('phone_brand', 'xiaomi', 'Xiaomi', 40),
    ('phone_color', 'den', 'Đen', 10),
    ('phone_color', 'trang', 'Trắng', 20),
    ('phone_color', 'xanh-la', 'Xanh lá', 30),
    ('phone_color', 'tim', 'Tím', 40),
    ('phone_color', 'vang', 'Vàng', 50),
    ('phone_storage', '64gb', '64GB', 10),
    ('phone_storage', '128gb', '128GB', 20),
    ('phone_storage', '256gb', '256GB', 30),
    ('phone_storage', '512gb', '512GB', 40),
    ('phone_made_in', 'vna', 'VN/A', 10),
    ('phone_made_in', 'lla', 'LL/A', 20),
    ('phone_made_in', 'trung-quoc', 'Trung Quốc', 30),
    ('phone_condition', 'moi-100', 'Mới 100%', 10),
    ('phone_condition', 'like-new', 'Like New', 20),
    ('phone_condition', 'cu', 'Cũ', 30),
    ('phone_battery_condition', 'zin', 'Zin', 10),
    ('phone_battery_condition', 'zin-90', 'Zin 90%', 20),
    ('phone_battery_condition', 'da-thay', 'Đã thay', 30),
    ('phone_battery_capacity', '100', '100%', 10),
    ('phone_battery_capacity', '90-100', '90-100%', 20),
    ('phone_battery_capacity', '80-90', '80-90%', 30),
    ('phone_model_name', '13-pro-max', '13 Pro Max', 10),
    ('phone_model_name', '14-pro-max', '14 Pro Max', 20),
    ('phone_model_name', '15-pro-max', '15 Pro Max', 30),
    ('accessory_code_prefix', 'pk', 'PK', 10)
)
insert into public.lookup_items (category_id, code, label, sort_order, is_system)
select c.id, s.item_code, s.item_label, s.sort_order, true
from seed s
join public.lookup_categories c on c.code = s.cat_code
where not exists (
  select 1 from public.lookup_items i
  where i.category_id = c.id and lower(i.code) = lower(s.item_code)
);

-- Demo customer
insert into public.customers (name, phone, note)
select 'Anh Minh', '0901 234 567', 'Hay mua iPhone cũ'
where not exists (select 1 from public.customers where phone = '0901 234 567');
