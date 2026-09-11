-- 班级成员增加用户名，用于审批/成员列表显示昵称而非邮箱。
alter table public.classroom_members
  add column if not exists username text;

NOTIFY pgrst, 'reload schema';
