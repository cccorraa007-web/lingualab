-- 备课资料库：老师主动收藏的备课素材（来源：语料库/必读文章/笔头作业）
create table if not exists public.lesson_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  source text not null check (source in ('material', 'reading', 'assignment')),
  source_id uuid not null,
  title text not null,
  created_at timestamptz not null default now(),
  unique (user_id, classroom_id, source, source_id)
);

create index if not exists idx_lesson_library_user
  on public.lesson_library(user_id, classroom_id, created_at desc);

alter table public.lesson_library enable row level security;
drop policy if exists "lesson_library_own" on public.lesson_library;
create policy "lesson_library_own" on public.lesson_library for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
