-- 教学模式：笔头作业、发布对象快照、学生提交与人工批改
-- 在 Supabase SQL Editor 执行后再启用前端功能。

create table if not exists public.classroom_assignments (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  content text not null,
  ends_at timestamptz not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint classroom_assignments_title_length check (char_length(title) between 1 and 300),
  constraint classroom_assignments_content_length check (char_length(content) between 1 and 12000)
);

create table if not exists public.assignment_recipients (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.classroom_assignments(id) on delete cascade,
  user_id uuid not null,
  email text,
  created_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.classroom_assignments(id) on delete cascade,
  user_id uuid not null,
  content text,
  media_paths text[] not null default '{}',
  ocr_text text,
  feedback text,
  score numeric(6,2),
  max_score numeric(6,2) not null default 100,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  graded_by uuid,
  graded_at timestamptz,
  unique (assignment_id, user_id),
  constraint assignment_submission_has_content check (
    nullif(btrim(content), '') is not null or cardinality(media_paths) > 0
  ),
  constraint assignment_score_valid check (
    score is null or (score >= 0 and score <= max_score)
  )
);

create index if not exists idx_assignments_classroom
  on public.classroom_assignments(classroom_id, created_at desc);
create index if not exists idx_assignment_recipients_assignment
  on public.assignment_recipients(assignment_id);
create index if not exists idx_assignment_recipients_user
  on public.assignment_recipients(user_id);
create index if not exists idx_assignment_submissions_assignment
  on public.assignment_submissions(assignment_id, submitted_at);
create index if not exists idx_assignment_submissions_user
  on public.assignment_submissions(user_id);

-- 提交被批改时自动刷新 updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.assignment_submissions') is not null then
    drop trigger if exists trg_assignment_submissions_updated_at
      on public.assignment_submissions;
    create trigger trg_assignment_submissions_updated_at
      before update on public.assignment_submissions
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

-- 班级共享数据沿用现有项目架构，由 API 对班级成员和角色逐次鉴权。
alter table public.classroom_assignments disable row level security;
alter table public.assignment_recipients disable row level security;
alter table public.assignment_submissions disable row level security;

NOTIFY pgrst, 'reload schema';
