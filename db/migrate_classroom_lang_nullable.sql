-- 班级语言不再默认标记为西语，改为发布第一篇必读文章后再判定
alter table public.classrooms alter column lang drop default;
alter table public.classrooms alter column lang drop not null;

-- 清理历史数据：尚无必读文章的班级，语言置空
update public.classrooms set lang = null
  where not exists (
    select 1 from public.classroom_readings r where r.classroom_id = public.classrooms.id
  );

NOTIFY pgrst, 'reload schema';
