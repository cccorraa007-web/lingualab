-- 为教师发布的笔头作业增加附件路径。
-- 依赖 db/migrate_assignments.sql 与 db/migrate_storage_assignments.sql。

alter table public.classroom_assignments
  add column if not exists media_paths text[] not null default '{}';

NOTIFY pgrst, 'reload schema';
