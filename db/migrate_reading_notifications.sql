-- 通知类型新增 new_reading：教师发布必读文章（课前预习）时提醒学生
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('submission', 'feedback', 'new_assignment', 'new_reading'));

NOTIFY pgrst, 'reload schema';
