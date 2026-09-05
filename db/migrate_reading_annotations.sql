-- 教学模式：学生阅读批注（词汇勾画 + 句子批注）
-- 在 Supabase SQL Editor 里执行。

create table if not exists public.reading_annotations (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.classroom_readings(id) on delete cascade,
  user_id uuid not null,
  text text not null,
  color text not null default 'yellow',
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_reading_annotations_reading on public.reading_annotations(reading_id);
create index if not exists idx_reading_annotations_user on public.reading_annotations(user_id);

NOTIFY pgrst, 'reload schema';
