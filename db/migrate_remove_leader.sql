-- 取消「班委」角色：把已有的班委成员转为普通学生
-- 在 Supabase SQL Editor 里执行一次即可。

update public.classroom_members
set role = 'student'
where role = 'leader';

NOTIFY pgrst, 'reload schema';
