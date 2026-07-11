-- Brand names for 3 locations (codes unchanged: store-1|2|3).

update public.stores
set name = 'Kim Chi Mobile', is_active = true
where code = 'store-1';

update public.stores
set name = 'Kiều Vy Mobile', is_active = true
where code = 'store-2';

update public.stores
set name = 'Cao Bắc Mobile', is_active = true
where code = 'store-3';
