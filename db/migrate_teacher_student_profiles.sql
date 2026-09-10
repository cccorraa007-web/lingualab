create or replace function public.get_classroom_student_learning_stats(p_classroom_id uuid)
returns table (
  user_id uuid, email text, self_reading_count bigint,
  speaking_count bigint, speaking_avg_score numeric, speaking_avg_duration numeric, speaking_last_7_days bigint,
  writing_count bigint, writing_avg_score numeric,
  mistake_count bigint, mistake_mastering bigint
)
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.classroom_members cm
    where cm.classroom_id = p_classroom_id and cm.user_id = auth.uid()
      and cm.role = 'teacher' and cm.status = 'approved'
  ) then raise exception 'forbidden'; end if;

  return query
  select m.user_id, m.email,
    (select count(*) from public.materials x where x.user_id = m.user_id and x.reading_id is null),
    (select count(*) from public.practice_sessions x where x.user_id = m.user_id),
    (select avg(nullif(x.assessment->>'total_score','')::numeric) from public.practice_sessions x where x.user_id = m.user_id),
    (select avg(x.duration_seconds) from public.practice_sessions x where x.user_id = m.user_id and x.duration_seconds > 0),
    (select count(*) from public.practice_sessions x where x.user_id = m.user_id and x.created_at >= now() - interval '7 days'),
    (select count(*) from public.writing_sessions x where x.user_id = m.user_id),
    (select avg(nullif(x.assessment->>'total_score','')::numeric) from public.writing_sessions x where x.user_id = m.user_id),
    (select count(*) from public.mistake_book x where x.user_id = m.user_id),
    (select count(*) from public.mistake_book x where x.user_id = m.user_id and coalesce(x.correct_streak, 0) > 0)
  from public.classroom_members m
  where m.classroom_id = p_classroom_id and m.role = 'student' and m.status = 'approved';
end;
$$;

revoke all on function public.get_classroom_student_learning_stats(uuid) from public;
grant execute on function public.get_classroom_student_learning_stats(uuid) to authenticated;
NOTIFY pgrst, 'reload schema';
