-- Ghi nhap: them cot ten (khong bat buoc), hien thi canh noi dung.

alter table public.draft_notes
  add column if not exists name text not null default '';
