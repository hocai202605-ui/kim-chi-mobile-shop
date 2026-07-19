-- Hình thức thanh toán trên đơn sửa chữa (Tiền mặt / Chuyển khoản).

alter table public.repair_orders
  add column if not exists payment_method text not null default 'Tiền mặt';

comment on column public.repair_orders.payment_method is
  'Hình thức TT: Tiền mặt | Chuyển khoản (khi đã thanh toán / kênh thu).';

-- Chuẩn hóa giá trị lạ (nếu có)
update public.repair_orders
set payment_method = 'Tiền mặt'
where trim(coalesce(payment_method, '')) = ''
   or payment_method not in ('Tiền mặt', 'Chuyển khoản');
