-- Tieu de ghi nhap khong bat buoc.

alter table public.draft_notes
  drop constraint if exists draft_notes_title_nonempty;

alter table public.draft_notes
  alter column title set default '';
