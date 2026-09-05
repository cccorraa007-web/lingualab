-- 教学模式：班级 + 班级成员
-- 在 Supabase SQL Editor 里执行。

create table if not exists public.classrooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classroom_members (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  user_id uuid not null,
  email text,
  role text not null default 'student' check (role in ('teacher', 'leader', 'student')),
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  unique (classroom_id, user_id)
);

create index if not exists idx_classroom_members_user on public.classroom_members(user_id);
create index if not exists idx_classroom_members_class on public.classroom_members(classroom_id);

-- 说明：这两个表为共享表，隔离在应用层（API 路由按成员关系过滤）完成，暂不启用 RLS。

NOTIFY pgrst, 'reload schema';
