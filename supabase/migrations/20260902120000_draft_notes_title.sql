-- Ghi nhap: them tieu de (hien thi 30% trai / noi dung 70% phai).

alter table public.draft_notes
  add column if not exists title text not null default '';

update public.draft_notes
set title = left(
  nullif(trim(split_part(content, E'\n', 1)), ''),
  200
)
where length(trim(title)) = 0;

update public.draft_notes
set title = 'Không có tiêu đề'
where length(trim(title)) = 0;

alter table public.draft_notes
  alter column title drop default;

alter table public.draft_notes
  drop constraint if exists draft_notes_title_nonempty;

alter table public.draft_notes
  add constraint draft_notes_title_nonempty check (length(trim(title)) > 0);
