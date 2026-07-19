-- Nhập hàng: thêm màu sắc (tùy chọn); địa chỉ/SĐT giữ cột DB nhưng UI không dùng.

alter table public.part_inbounds
  add column if not exists color text not null default '';
