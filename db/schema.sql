-- HablaYa 数据库 schema（在 Supabase SQL Editor 里执行）

-- 话题字典（固定 12 个一级主题，受控词表）
create table if not exists public.topics (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name_zh text not null,
  name_es text not null,
  is_active boolean not null default true
);

-- 原始材料（文本/URL/音频，音频的转写全文存 raw_text）
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default '00000000-0000-0000-0000-000000000001',
  type text not null check (type in ('text', 'url', 'audio')),
  title text,
  raw_text text not null,
  created_at timestamptz not null default now()
);

-- 语料卡片（一次 AI 处理生成）
create table if not exists public.corpus_cards (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  primary_topic text not null,
  secondary_topics text[] not null default '{}',
  subtopics text[] not null default '{}',
  cefr_level text,
  ai_output jsonb,
  created_at timestamptz not null default now()
);

-- 关键词
create table if not exists public.keywords (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.corpus_cards(id) on delete cascade,
  word text not null,
  pos text,
  zh text,
  freq int not null default 1
);

-- 地道表达
create table if not exists public.expressions (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.corpus_cards(id) on delete cascade,
  phrase text not null,
  zh text,
  type text,
  register text,
  example text,
  example_zh text
);

-- 口语练习素材
create table if not exists public.speaking_prompts (
  id bigint generated always as identity primary key,
  card_id uuid not null references public.corpus_cards(id) on delete cascade,
  question text not null,
  useful_chunks text[],
  sample_hint text
);

-- M2 阶段：临时禁用 RLS（尚未接入登录，便于本地开发）。
-- M3 接入 Supabase Auth 后，改为 enable 并添加按 user_id 的隔离策略。
alter table public.topics disable row level security;
alter table public.materials disable row level security;
alter table public.corpus_cards disable row level security;
alter table public.keywords disable row level security;
alter table public.expressions disable row level security;
alter table public.speaking_prompts disable row level security;

-- 种子：12 个一级主题
insert into public.topics (slug, name_zh, name_es) values
  ('vida-cultural', '文化生活', 'Vida cultural'),
  ('educacion', '教育学习', 'Educación'),
  ('trabajo', '工作职场', 'Trabajo'),
  ('tecnologia', '科技与互联网', 'Tecnología'),
  ('salud', '健康与医疗', 'Salud'),
  ('medio-ambiente', '环境与气候', 'Medio ambiente'),
  ('sociedad', '社会与热点', 'Sociedad y actualidad'),
  ('economia', '经济与消费', 'Economía'),
  ('viajes', '旅行与交通', 'Viajes y transporte'),
  ('relaciones', '情感与家庭', 'Relaciones y familia'),
  ('gastronomia', '美食与餐饮', 'Gastronomía'),
  ('deporte', '体育与休闲', 'Deporte y ocio')
on conflict (slug) do nothing;

-- 索引（语料检索常用）
create index if not exists idx_materials_user on public.materials(user_id, created_at desc);
create index if not exists idx_cards_topic on public.corpus_cards(primary_topic);
create index if not exists idx_cards_material on public.corpus_cards(material_id);

-- 刷新 PostgREST 缓存，确保新表立即可查
NOTIFY pgrst, 'reload schema';
