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
    'application/pdf'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 路径固定为 {assignment_id}/{user_id}/{随机文件名}。
-- 学生只能上传、读取和删除自己的附件；任课教师可读取所教班级的附件。
drop policy if exists "assignment_files_upload" on storage.objects;
create policy "assignment_files_upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "assignment_files_read" on storage.objects;
create policy "assignment_files_read"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'assignment-files'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1
        from public.classroom_assignments a
        join public.classroom_members m on m.classroom_id = a.classroom_id
        where a.id::text = (storage.foldername(name))[1]
          and m.user_id = auth.uid()
          and m.role = 'teacher'
          and m.status = 'approved'
      )
    )
  );

drop policy if exists "assignment_files_delete_own" on storage.objects;
create policy "assignment_files_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'assignment-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
