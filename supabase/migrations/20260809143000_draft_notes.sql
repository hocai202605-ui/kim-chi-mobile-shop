-- Ghi nhap nhanh: free-text notes per store, with create/update audit fields.

create table if not exists public.draft_notes (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id),
  content     text not null default '',
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text,
  updated_by  text,
  constraint draft_notes_content_nonempty check (length(trim(content)) > 0),
  constraint draft_notes_status_check check (status in ('active', 'cancelled'))
);

create index if not exists draft_notes_store_id_idx
  on public.draft_notes (store_id);

create index if not exists draft_notes_updated_at_idx
  on public.draft_notes (updated_at desc);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists draft_notes_set_updated_at on public.draft_notes;
    create trigger draft_notes_set_updated_at
      before update on public.draft_notes
      for each row execute function public.set_updated_at();
  end if;
end $$;
