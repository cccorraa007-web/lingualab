-- 语料库重构迁移：统一语料条目表
-- 旧结构（每篇文章一张卡片 + 子表）改为：每条语料一个条目，带 status(draft/saved) 和 snippet(定位原文)

-- 删除旧表（当前只有测试数据，可安全删除）
drop table if exists public.speaking_prompts;
drop table if exists public.expressions;
drop table if exists public.keywords;
drop table if exists public.corpus_cards;

-- 新的统一语料条目表
create table public.corpus_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  material_id uuid references public.materials(id) on delete cascade,
  category text not null check (category in ('keyword', 'expression', 'prompt')),
  topic text,
  content text not null,
  zh text,
  extra jsonb not null default '{}'::jsonb,
  snippet text,
  status text not null default 'draft' check (status in ('draft', 'saved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_cards_status on public.corpus_cards(status);
create index if not exists idx_cards_material on public.corpus_cards(material_id);
create index if not exists idx_cards_category on public.corpus_cards(category);
create index if not exists idx_cards_topic on public.corpus_cards(topic);

-- M2 阶段临时禁用 RLS（M3 接入登录后再启用）
alter table public.corpus_cards disable row level security;

NOTIFY pgrst, 'reload schema';
