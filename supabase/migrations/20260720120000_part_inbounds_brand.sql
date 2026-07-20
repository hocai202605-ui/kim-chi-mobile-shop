-- Nhập hàng: thêm hãng (tùy chọn), free-text + droplist ở UI.

alter table public.part_inbounds
  add column if not exists brand text not null default '';
