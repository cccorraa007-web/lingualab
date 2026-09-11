alter table public.classroom_assignments
  add column if not exists teacher_answer_paths text[] not null default '{}',
  add column if not exists teacher_answer_text text;
