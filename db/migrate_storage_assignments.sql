-- 笔头作业附件存储桶（私有）
-- 学生提交的图片/音频/视频/PDF 属于班级内私密数据，不对外公开。
-- 在 Supabase SQL Editor 执行一次即可。

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-files',
  'assignment-files',
  false,
  26214400,
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'audio/mpeg','audio/wav','audio/webm',
    'video/mp4','video/webm',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 路径固定为 {assignment_id}/{user_id}/{随机文件名}。
-- 上传者只能管理自己的附件；教师可读全班提交，学生可读教师发布附件。
drop policy if exists "assignment_files_upload" on storage.objects;
create policy "assignment_files_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assignment-files'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[2] = 'teacher_answer'
        and exists (
          select 1 from public.classroom_assignments a
          join public.classroom_members m on m.classroom_id = a.classroom_id
          where a.id::text = (storage.foldername(name))[1]
            and m.user_id = auth.uid() and m.status = 'approved' and m.role = 'teacher'
        )
      )
    )
  );

drop policy if exists "assignment_files_read" on storage.objects;
create policy "assignment_files_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      ((storage.foldername(name))[2] = auth.uid()::text and (storage.foldername(name))[2] <> 'teacher_answer')
      or exists (
        select 1
        from public.classroom_assignments a
        join public.classroom_members m on m.classroom_id = a.classroom_id
        where a.id::text = (storage.foldername(name))[1]
          and m.user_id = auth.uid()
          and m.status = 'approved'
          and (
            m.role = 'teacher'
            or (
              m.role = 'student'
              and (storage.foldername(name))[2] = a.created_by::text
            )
          )
      )
    )
  );

drop policy if exists "assignment_files_delete_own" on storage.objects;
create policy "assignment_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[2] = 'teacher_answer'
        and exists (
          select 1 from public.classroom_assignments a
          join public.classroom_members m on m.classroom_id = a.classroom_id
          where a.id::text = (storage.foldername(name))[1]
            and m.user_id = auth.uid() and m.status = 'approved' and m.role = 'teacher'
        )
      )
    )
  );
