-- Bổ sung cột cost_price (giá nhập) và retail_price (giá thay khách) cho bảng part_inbounds.

alter table public.part_inbounds
  add column if not exists cost_price numeric(15,2) null,
  add column if not exists retail_price numeric(15,2) null;
