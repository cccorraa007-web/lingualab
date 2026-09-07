alter table public.classroom_assignments
  add column if not exists class_summary text,
  add column if not exists class_analysis_at timestamptz;

NOTIFY pgrst, 'reload schema';
