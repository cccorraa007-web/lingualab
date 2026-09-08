-- 口语练习记录补全：一次性补齐 assessment（AI 评分）与 duration_seconds（时长）两列
alter table public.practice_sessions
  add column if not exists assessment jsonb,
  add column if not exists duration_seconds int;

NOTIFY pgrst, 'reload schema';
