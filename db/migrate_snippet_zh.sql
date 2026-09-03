-- 卡片原文定位片段增加中文翻译字段
alter table public.corpus_cards add column if not exists snippet_zh text;

NOTIFY pgrst, 'reload schema';
