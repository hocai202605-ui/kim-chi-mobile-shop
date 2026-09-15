-- Tools: store account / password notes per store (clone of draft_notes).

create table if not exists public.tool_notes (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores (id),
  title       text not null default '',
  account     text not null,
  password    text not null default '',
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text,
  updated_by  text,
  constraint tool_notes_account_nonempty check (length(trim(account)) > 0),
  constraint tool_notes_status_check check (status in ('active', 'cancelled'))
);

create index if not exists tool_notes_store_id_idx
  on public.tool_notes (store_id);

create index if not exists tool_notes_updated_at_idx
  on public.tool_notes (updated_at desc);

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_updated_at'
  ) then
    drop trigger if exists tool_notes_set_updated_at on public.tool_notes;
    create trigger tool_notes_set_updated_at
      before update on public.tool_notes
      for each row execute function public.set_updated_at();
  end if;
end $$;
