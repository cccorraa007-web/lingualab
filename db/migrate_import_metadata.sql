-- 导入选项与随导入保留的结构化笔记。
alter table public.lesson_library
  add column if not exists keep_notes boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.materials
  add column if not exists metadata jsonb not null default '{}'::jsonb;
