-- 口语练习记录表
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  mode text not null,
  topic text,
  content jsonb not null default '{}'::jsonb,
  polish jsonb,
  created_at timestamptz not null default now()
);

alter table public.practice_sessions disable row level security;

NOTIFY pgrst, 'reload schema';
