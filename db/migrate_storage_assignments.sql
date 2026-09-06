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

-- 访问策略：仅登录用户可上传/读取本桶。
-- 与班级共享表一致，班级级隔离在应用层（API 按成员关系过滤）完成；
-- 建议上传路径统一为 assignment-files/{assignment_id}/{user_id}/...，
-- 后续可据此把策略收紧到「只能读写自己或本班的文件」。
drop policy if exists "assignment_files_upload" on storage.objects;
create policy "assignment_files_upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-files');

drop policy if exists "assignment_files_read" on storage.objects;
create policy "assignment_files_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'assignment-files');
