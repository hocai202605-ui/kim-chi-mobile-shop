-- Remove temporary staff accounts (replaced by store users kimchi/kieuvy/caobac).

delete from public.app_accounts
where lower(username) in ('huyen', 'bac', 'sang');
