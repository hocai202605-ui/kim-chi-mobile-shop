-- sale_items thiếu updated_at trên một số môi trường (migration 20260712120000 chưa apply đủ).
-- repoCancelSale / sửa phiếu (hủy mềm) ghi updated_at → lỗi: column "updated_at" does not exist.

alter table public.sale_items
  add column if not exists updated_at timestamptz not null default now();

-- Trigger tự stamp updated_at (reuse helper nếu có)
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'ensure_updated_at_trigger'
  ) then
    perform public.ensure_updated_at_trigger('sale_items');
  elsif exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists sale_items_set_updated_at on public.sale_items;
    create trigger sale_items_set_updated_at
      before update on public.sale_items
      for each row execute function public.set_updated_at();
  end if;
end $$;

comment on column public.sale_items.updated_at is 'Thời điểm cập nhật dòng phiếu (hủy / sửa trạng thái)';
