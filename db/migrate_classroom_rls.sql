-- 教学模式班级相关表：关闭 RLS
-- 原因：这些是「共享表」，多用户共同访问，隔离在应用层（API 按成员关系过滤）完成。
-- Supabase 默认给新表开启了 RLS 但无策略，导致插入/查询被拦（"violates row-level security"）。
-- 在 Supabase SQL Editor 里执行一次即可。

alter table public.classrooms disable row level security;
alter table public.classroom_members disable row level security;
alter table public.classroom_readings disable row level security;
alter table public.reading_annotations disable row level security;

NOTIFY pgrst, 'reload schema';
