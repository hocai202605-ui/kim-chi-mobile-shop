-- Demo inventory seed (idempotent by IMEI / store+code)
select set_config('app.skip_status_guard', 'on', true);

with s as (
  select code, id from public.stores
)
insert into public.phones (
  store_id, brand, model_name, imei, color, storage, made_in, network_version,
  battery_condition, battery_capacity, condition, note, import_date, sale_date,
  cost, expected_price, status
)
select st.id, v.brand, v.model_name, v.imei, v.color, v.storage, v.made_in, v.network_version,
  v.battery_condition, v.battery_capacity, v.condition, v.note, v.import_date::date, nullif(v.sale_date,'')::date,
  v.cost, v.expected_price, v.status::public.phone_status
from (values
  ('store-1','iPhone','13 Pro Max','356789101234561','Xanh lá','256GB','VN/A','5G','Zin 92%','','Like New','Máy đẹp keng, full box','2026-07-01','',13500000,15200000,'in_stock'),
  ('store-2','iPhone','12','356789101234562','Đen','128GB','LL/A','5G','80-90%','','Cũ','Trầy viền nhẹ','2026-07-02','',7200000,8200000,'in_stock'),
  ('store-3','Samsung','Galaxy S22 Ultra','356789101234563','Đỏ','256GB','VN/A','5G','Zin','','Like New','Còn bảo hành hãng','2026-07-03','',12500000,14000000,'in_stock'),
  ('store-1','iPhone','11','356789101234564','Tím','64GB','VN/A','4G','Đã thay','','Cũ','Máy zin áp','2026-07-01','',5500000,6500000,'in_stock'),
  ('store-2','Oppo','Reno 8','356789101234565','Vàng','256GB','Trung Quốc','5G','Zin','','Mới 100%','Nguyên seal','2026-07-04','',7000000,8500000,'in_stock'),
  ('store-3','Xiaomi','Redmi Note 12','356789101234566','Xám','128GB','Trung Quốc','5G','Zin','','Like New','','2026-07-05','',3500000,4200000,'in_stock'),
  ('store-1','iPhone','14 Pro Max','356789101234567','Tím','256GB','LL/A','5G','Zin 98%','','Like New','Kèm ốp','2026-07-02','',21500000,23200000,'in_stock'),
  ('store-1','iPhone','15 Pro Max','356789101234568','Titan','512GB','VN/A','5G','Zin 100%','','Mới 100%','Chưa active','2026-07-05','',29500000,32000000,'in_stock'),
  ('store-2','Samsung','Z Fold 5','356789101234569','Xanh dương','512GB','VN/A','5G','Zin','','Like New','S-Pen','2026-07-06','',25000000,28000000,'in_stock'),
  ('store-3','iPhone','XS Max','356789101234570','Vàng','256GB','LL/A','4G','Đã thay pin','','Cũ','Xước màn','2026-07-01','',4500000,5500000,'in_stock'),
  ('store-2','Oppo','Find X5 Pro','356789101234571','Trắng','256GB','Trung Quốc','5G','Zin','','Like New','Mặt lưng gốm','2026-07-03','',9000000,10500000,'in_stock'),
  ('store-1','iPhone','14','356789101234572','Xanh biển','128GB','VN/A','5G','Zin 88%','','Cũ','Phụ kiện sạc cáp','2026-06-20','2026-07-05',13000000,14500000,'sold'),
  ('store-1','iPhone','13','356789101234573','Hồng','128GB','VN/A','5G','Zin 90%','','Like New','Máy nữ dùng','2026-06-25','2026-07-06',10500000,11800000,'sold'),
  ('store-3','Samsung','Galaxy A54','356789101234574','Tím','128GB','Việt Nam','5G','Zin','','Mới 100%','Tặng kèm ốp','2026-07-06','',6500000,7500000,'in_stock')
) as v(store_code, brand, model_name, imei, color, storage, made_in, network_version, battery_condition, battery_capacity, condition, note, import_date, sale_date, cost, expected_price, status)
join s st on st.code = v.store_code
where not exists (select 1 from public.phones p where p.imei = v.imei);

with s as (select code, id from public.stores)
insert into public.accessories (store_id, code, name, quantity, cost, price, status)
select st.id, v.code, v.name, v.quantity, v.cost, v.price, v.status::public.accessory_status
from (values
  ('store-1','PK-CAP20','Cáp sạc nhanh 20W Apple',34,55000,120000,'in_stock'),
  ('store-2','PK-OP13','Ốp lưng Silicon iPhone 13 Pro Max',18,30000,90000,'in_stock'),
  ('store-3','PK-KLCL','Kính cường lực Kingkong',50,18000,70000,'in_stock'),
  ('store-1','PK-SDP10','Sạc dự phòng 10000mAh',12,250000,400000,'in_stock'),
  ('store-1','PK-TNAP','Tai nghe AirPods Pro 2 Rep',5,350000,550000,'in_stock'),
  ('store-2','PK-OP14','Ốp lưng chống sốc iPhone 14',0,40000,110000,'out_of_stock'),
  ('store-3','PK-SAC65','Củ sạc GaN 65W Baseus',8,320000,550000,'in_stock'),
  ('store-1','PK-GIA','Giá đỡ điện thoại ô tô',15,70000,150000,'in_stock'),
  ('store-2','PK-DNM','Dây đeo Apple Watch cao su',22,45000,120000,'in_stock'),
  ('store-3','PK-KLCL-S22','Cường lực Samsung S22',10,20000,80000,'in_stock')
) as v(store_code, code, name, quantity, cost, price, status)
join s st on st.code = v.store_code
where not exists (
  select 1 from public.accessories a
  where a.store_id = st.id and a.code = v.code and a.status <> 'cancelled'
);
