-- 口语练习：练习记录（时间 / 主题 / 轮次 / 对话稿 / 润色建议）
create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  lang text not null default 'es',
  topic text not null,
  rounds int not null default 0,
  transcript jsonb not null default '[]'::jsonb,
  polish jsonb not null default '[]'::jsonb,
  assessment jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_sessions_user
  on public.practice_sessions(user_id, created_at desc);

alter table public.practice_sessions enable row level security;
drop policy if exists "practice_sessions_own" on public.practice_sessions;
create policy "practice_sessions_own" on public.practice_sessions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
