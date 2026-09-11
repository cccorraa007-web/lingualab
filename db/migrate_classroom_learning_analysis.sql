-- 仅本班已审批教师可读取学生错题内容，用于生成匿名的班级学情分析。
create or replace function public.get_classroom_mistake_evidence(p_classroom_id uuid)
returns table (error_type text, wrong text, correct text)
language sql security definer set search_path = public
as $$
  select x.error_type, x.wrong, x.correct
  from public.mistake_book x
  where x.user_id in (
    select m.user_id from public.classroom_members m
    where m.classroom_id = p_classroom_id and m.role = 'student' and m.status = 'approved'
  ) and exists (
    select 1 from public.classroom_members teacher
    where teacher.classroom_id = p_classroom_id and teacher.user_id = auth.uid()
      and teacher.role = 'teacher' and teacher.status = 'approved'
  );
$$;
revoke all on function public.get_classroom_mistake_evidence(uuid) from public;
grant execute on function public.get_classroom_mistake_evidence(uuid) to authenticated;
notify pgrst, 'reload schema';
