-- 错题本：口译练习字段（间隔重复）
alter table public.mistake_book
  add column if not exists wrong_count int not null default 0,
  add column if not exists correct_streak int not null default 0,
  add column if not exists last_reviewed_at timestamptz;

NOTIFY pgrst, 'reload schema';
