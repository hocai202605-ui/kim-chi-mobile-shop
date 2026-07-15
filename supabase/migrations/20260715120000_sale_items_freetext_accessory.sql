-- Cho phép dòng phụ kiện free-text (không gắn accessories.id, không trừ tồn kho).
-- Giữ ràng buộc máy: phone_id bắt buộc, SL = 1.

alter table public.sale_items drop constraint if exists sale_items_phone_shape;

alter table public.sale_items
  add constraint sale_items_phone_shape check (
    (
      item_type = 'phone'
      and phone_id is not null
      and accessory_id is null
      and quantity = 1
    )
    or
    (
      item_type = 'accessory'
      and phone_id is null
      and length(trim(item_name)) > 0
    )
  );
