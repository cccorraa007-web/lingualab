alter table public.assignment_submissions
  add column if not exists grade text;

alter table public.assignment_submissions
  drop constraint if exists assignment_grade_valid;
alter table public.assignment_submissions
  add constraint assignment_grade_valid
  check (grade is null or grade in ('A+', 'A', 'B+', 'B', 'C+', 'C', 'D'));

NOTIFY pgrst, 'reload schema';
