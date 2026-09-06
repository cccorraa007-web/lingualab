-- 教学模式：必读文章的题目（教师划线句子 + 添加题目，全班共享）
-- 在 Supabase SQL Editor 里执行。

create table if not exists public.reading_questions (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.classroom_readings(id) on delete cascade,
  sentence text not null,
  question text not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_reading_questions_reading on public.reading_questions(reading_id);

NOTIFY pgrst, 'reload schema';
