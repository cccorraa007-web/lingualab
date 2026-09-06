-- 教学模式：学生对题目作答 + 教师批改留言
-- 在 Supabase SQL Editor 里执行。

create table if not exists public.reading_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.reading_questions(id) on delete cascade,
  user_id uuid not null,
  email text,
  answer text,
  feedback text,
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create index if not exists idx_reading_answers_question on public.reading_answers(question_id);
create index if not exists idx_reading_answers_user on public.reading_answers(user_id);

NOTIFY pgrst, 'reload schema';
