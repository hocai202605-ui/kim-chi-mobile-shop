-- Bảng quản lý Link (sub-menu trong Mình nợ)

create table if not exists public.link_notes (
  id              uuid primary key default gen_random_uuid(),
  store_id        uuid not null references public.stores (id),
  title           text not null,
  link_url        text not null,
  status          public.record_status not null default 'active',
  created_by      text,
  updated_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists link_notes_store_status_idx
  on public.link_notes (store_id, status);
create index if not exists link_notes_status_idx
  on public.link_notes (status);

drop trigger if exists link_notes_set_updated_at on public.link_notes;
create trigger link_notes_set_updated_at
  before update on public.link_notes
  for each row execute function public.set_updated_at();
