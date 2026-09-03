-- 给材料表补充话题元信息字段（轻量迁移，不丢数据）
alter table public.materials
  add column if not exists primary_topic text,
  add column if not exists secondary_topics text[] not null default '{}',
  add column if not exists subtopics text[] not null default '{}',
  add column if not exists cefr_level text;

NOTIFY pgrst, 'reload schema';
