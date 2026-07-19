-- Phiếu nhập hàng (menu NHẬP HÀNG) — persist Postgres, lọc theo store.

create table if not exists public.part_inbounds (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null references public.stores (id),
  distributor   text not null default '',
  address       text not null default '',
  phone         text not null default '',
  part_type     text not null default '',
  part_name     text not null default '',
  quantity      integer not null default 0 check (quantity >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    text,
  updated_by    text,
  constraint part_inbounds_distributor_nonempty check (length(trim(distributor)) > 0),
  constraint part_inbounds_part_type_nonempty check (length(trim(part_type)) > 0),
  constraint part_inbounds_part_name_nonempty check (length(trim(part_name)) > 0)
);

create index if not exists part_inbounds_store_id_idx
  on public.part_inbounds (store_id);
create index if not exists part_inbounds_created_at_idx
  on public.part_inbounds (created_at desc);
create index if not exists part_inbounds_distributor_idx
  on public.part_inbounds (lower(distributor));

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists part_inbounds_set_updated_at on public.part_inbounds;
    create trigger part_inbounds_set_updated_at
      before update on public.part_inbounds
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed demo Kim Chi (store-1) nếu bảng trống
insert into public.part_inbounds (
  store_id, distributor, address, phone, part_type, part_name, quantity, created_by, updated_by
)
select
  s.id,
  v.distributor,
  v.address,
  v.phone,
  v.part_type,
  v.part_name,
  v.quantity,
  'quynhbupbe',
  'quynhbupbe'
from public.stores s
cross join (
  values
    ('NPP Linh kiện A', '12 Nguyễn Trãi, Q1', '0901234567', 'Màn hình', 'LCD iPhone 11 zin', 5),
    ('Kho pin B', '88 Lê Lợi, Q3', '0912345678', 'Pin', 'Pin iPhone 12 dung lượng cao', 10)
) as v(distributor, address, phone, part_type, part_name, quantity)
where s.code = 'store-1'
  and not exists (select 1 from public.part_inbounds limit 1);
