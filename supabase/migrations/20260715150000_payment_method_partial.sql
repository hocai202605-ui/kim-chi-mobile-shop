-- Thanh toán 1 phần (partial) trên phiếu bán.

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'payment_method'
      and e.enumlabel = 'partial'
  ) then
    alter type public.payment_method add value 'partial';
  end if;
end $$;
