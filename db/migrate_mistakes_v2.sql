-- 错题本表重构：聚焦核心错误点（类型 + 错误 → 正确 + 参考例句）
drop table if exists public.mistake_book;

create table public.mistake_book (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  error_type text not null default '其他',
  wrong text not null,
  correct text not null,
  example text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mistake_book_created on public.mistake_book(created_at desc);

alter table public.mistake_book disable row level security;

NOTIFY pgrst, 'reload schema';
