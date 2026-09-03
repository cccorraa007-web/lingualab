-- 错题本表（用户筛选后收集的中式西语/语法/用词错误）
create table if not exists public.mistake_book (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  original text not null,
  revised text not null,
  reason text,
  category text not null default '中式西语',
  created_at timestamptz not null default now()
);

create index if not exists idx_mistake_book_created on public.mistake_book(created_at desc);

alter table public.mistake_book disable row level security;

NOTIFY pgrst, 'reload schema';
