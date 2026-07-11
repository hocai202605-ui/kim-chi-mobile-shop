-- App accounts + menu permissions (demo login username/password; not Supabase Auth).
-- Passwords seeded as bcrypt via pgcrypto crypt().

create table if not exists public.app_accounts (
  id            uuid primary key default gen_random_uuid(),
  username      text not null,
  display_name  text not null,
  password_hash text not null,
  role          public.app_role not null default 'staff',
  store_code    text not null default 'store-1',
  allowed_menus text[] not null default '{}',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint app_accounts_username_nonempty check (length(trim(username)) > 0),
  constraint app_accounts_store_code_format check (store_code ~ '^store-[0-9]+$')
);

create unique index if not exists app_accounts_username_uidx
  on public.app_accounts (lower(username));

create index if not exists app_accounts_role_idx on public.app_accounts (role);

drop trigger if exists app_accounts_set_updated_at on public.app_accounts;
create trigger app_accounts_set_updated_at
  before update on public.app_accounts
  for each row execute function public.set_updated_at();

-- All nav menu ids (must match app/page.tsx navItems)
-- dashboard, inventory, inventoryReports, sales, software, online-repairs,
-- customers, repairs, ledger, logs, accounts

with seed(
  username, display_name, role, store_code, allowed_menus
) as (
  values
    (
      'admin',
      'Admin',
      'owner'::public.app_role,
      'store-1',
      array[
        'dashboard','inventory','inventoryReports','sales','software',
        'online-repairs','customers','repairs','ledger','logs','accounts'
      ]::text[]
    ),
    (
      'quynhbupbe',
      'Quỳnh Búp Bê',
      'owner'::public.app_role,
      'store-1',
      array[
        'dashboard','inventory','inventoryReports','sales','software',
        'online-repairs','customers','repairs','ledger','logs','accounts'
      ]::text[]
    )
)
insert into public.app_accounts (
  username, display_name, password_hash, role, store_code, allowed_menus, is_active
)
select
  s.username,
  s.display_name,
  crypt('123456', gen_salt('bf')),
  s.role,
  s.store_code,
  s.allowed_menus,
  true
from seed s
where not exists (
  select 1 from public.app_accounts a
  where lower(a.username) = lower(s.username)
);
