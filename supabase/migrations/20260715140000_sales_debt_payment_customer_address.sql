-- Bán hàng: thanh toán Nợ + địa chỉ khách.

-- payment_method += debt (Nợ)
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_method'
      and e.enumlabel = 'debt'
  ) then
    alter type public.payment_method add value 'debt';
  end if;
end $$;

-- customers.address
alter table public.customers
  add column if not exists address text not null default '';

comment on column public.customers.address is 'Địa chỉ khách (tuỳ chọn).';
