-- 教师端「学生档案」聚合函数（彻底清理旧版后重建）
-- 背景：线上旧版函数存在 session_type 引用、user_id 歧义等问题，
-- 且可能有多重重载/不同返回类型，导致 create or replace 或简单 drop(uuid) 覆盖失败。
-- 本文件先遍历删除所有同名重载（含级联依赖），再重建正确版本。

do $$
declare r record;
begin
  for r in
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname = 'get_classroom_student_learning_stats'
  loop
    execute format('drop function if exists public.%I(%s) cascade', r.name, r.args);
  end loop;
end $$;

create function public.get_classroom_student_learning_stats(p_classroom_id uuid)
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
