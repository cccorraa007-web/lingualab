-- 为班级必读文章记录班级作答的整体情况分析，供辅助备课结合学生学情。
-- 依赖 db/migrate_readings.sql。

alter table public.classroom_readings
  add column if not exists class_summary text,
  add column if not exists class_analysis_at timestamptz;

NOTIFY pgrst, 'reload schema';
