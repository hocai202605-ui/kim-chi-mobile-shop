-- Tách phiếu Bán hàng (retail) vs Bán Gà (ban_ga) trên cùng bảng sales.

alter table public.sales
  add column if not exists channel text not null default 'retail';

alter table public.sales
  drop constraint if exists sales_channel_check;
alter table public.sales
  add constraint sales_channel_check
  check (channel in ('retail', 'ban_ga'));

create index if not exists sales_channel_sold_at_idx
  on public.sales (channel, sold_at desc);