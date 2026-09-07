create table if not exists public.writing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  lang text not null check (lang in ('es', 'en')),
  title text not null,
  essay text not null,
  polish jsonb not null default '[]'::jsonb,
  assessment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_writing_sessions_user
  on public.writing_sessions(user_id, created_at desc);

alter table public.writing_sessions enable row level security;
drop policy if exists "writing_sessions_own" on public.writing_sessions;
create policy "writing_sessions_own" on public.writing_sessions
  for all to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
