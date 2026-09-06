-- 一、防止重复加入资料库：给 materials 加 reading_id 标记来源
alter table public.materials add column if not exists reading_id uuid;

-- 二、通知系统
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null check (type in ('submission', 'feedback')),
  classroom_id uuid,
  reading_id uuid,
  title text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on public.notifications(user_id, read);

NOTIFY pgrst, 'reload schema';
