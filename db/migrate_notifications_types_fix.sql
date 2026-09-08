-- 通知类型统一修复：
-- 1) 笔头作业迁移（migrate_assignments_notifications.sql）曾误删 new_reading，导致教师发布必读文章时学生收不到提醒；
-- 2) 新增 member_request：新成员申请加入班级时提醒教师审批。
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('submission', 'feedback', 'new_assignment', 'new_reading', 'member_request'));

NOTIFY pgrst, 'reload schema';
