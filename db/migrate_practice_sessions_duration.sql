-- 口语练习记录：补充每次练习时长（秒），用于课外学习情况统计
alter table public.practice_sessions
  add column if not exists duration_seconds int;

NOTIFY pgrst, 'reload schema';
