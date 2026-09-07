-- 口语练习记录：补充 AI 整体评估（总分 / 分维度 / 优缺点 / 总结）
alter table public.practice_sessions
  add column if not exists assessment jsonb;

NOTIFY pgrst, 'reload schema';
