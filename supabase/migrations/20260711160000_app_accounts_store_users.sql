-- Store-scoped staff logins (pass default 123456; change later via admin).
-- kimchi → store-1, kieuvy → store-2, caobac → store-3

with seed(username, display_name, role, store_code, allowed_menus) as (
  values
    ('kimchi', 'Kim Chi Mobile', 'staff'::public.app_role, 'store-1', array['inventory']::text[]),
    ('kieuvy', 'Kiều Vy Mobile', 'staff'::public.app_role, 'store-2', array['inventory']::text[]),
    ('caobac', 'Cao Bắc Mobile', 'staff'::public.app_role, 'store-3', array['inventory']::text[])
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
