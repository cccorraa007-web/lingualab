-- 教学模式：班级必读文章（含起止时间）
-- 在 Supabase SQL Editor 里执行。

create table if not exists public.classroom_readings (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  title text not null,
  raw_text text not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_readings_class on public.classroom_readings(classroom_id);

NOTIFY pgrst, 'reload schema';
