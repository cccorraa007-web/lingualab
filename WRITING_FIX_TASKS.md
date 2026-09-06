# 笔头作业待修问题（写作模块负责人：请按此文档修改）

> 背景：`feature/writing-complete` 已合并进 main。你实现的 `WrittenAssignments.tsx` + 相关接口已接入。
> 但教师端测试时发现两个缺口，需要你补上。本文只列问题和改法，不替你写代码，改完请自行 lint/build 并提交。

---

## 问题一：教师发布笔头作业时无法上传附件

### 现状
- 教师发布表单只有「题目 + 要求 + 截止时间」，没有附件上传入口。
- 数据表 `classroom_assignments` 没有附件字段（`assignment_submissions` 才有 `media_paths`）。
- `src/app/api/classrooms/[id]/assignments/route.ts` 的 `POST` 只接收 JSON（title/content/ends_at），不上传文件。

### 要改什么

**1）数据层**
- 给 `classroom_assignments` 加附件字段，建议与 `assignment_submissions` 保持一致的命名：
  ```sql
  alter table public.classroom_assignments
    add column if not exists media_paths text[] not null default '{}';
  ```
  写进一个新迁移文件 `db/migrate_assignments_attachments.sql`（参考现有 `db/migrate_assignments.sql` 风格）。

**2）存储层（RLS 要改，重点）**
- 附件仍存到 `assignment-files` 桶，路径沿用现有规范 `{assignment_id}/{user_id}/{随机文件名}`。
- 教师上传时 `user_id` 段用教师自己的 `auth.uid()`，这样**上传/删除策略已放行**（`[2] = auth.uid()`）。
- **但读取策略要补**：现在 `assignment_files_read` 只允许「本人」或「本班教师」读取。学生要看到教师上传的附件，需要在 `db/migrate_storage_assignments.sql` 里给 read policy 增加一条分支：允许「本班学生」读取本班作业的附件（用 `classroom_members` 判断，类似现有教师分支，把 `m.role = 'teacher'` 改成 `m.role in ('teacher','student')` 即可）。
- 改完让使用方重新执行该迁移文件。

**3）接口层 `src/app/api/classrooms/[id]/assignments/route.ts`**
- `POST` 改成支持 `multipart/form-data`（含 `content` + `files[]`），复用你 `submit/route.ts` 里已有的上传写法（`auth.client.storage.from("assignment-files").upload(...)`、`safeName`、类型/大小校验）。
- 上传路径用 `{assignment.id}/{auth.user.id}/{随机文件名}`。
- `GET` 里给 `assignments` 也补 `media_urls`（用 `createSignedUrls`），方法参考你现有的 `addMediaUrls`（现在它只处理 `submissions`，抽成通用函数即可）。

**4）前端 `src/app/teaching/[id]/assignments/WrittenAssignments.tsx`**
- 发布表单加「附件」文件选择（`<input type="file" multiple>`），提交时用 `FormData`。
- 作业卡片里显示教师附件链接（学生端也要能看到，教师端自然也能看到）。

---

## 问题二：教师无法点进去查看学生提交详情

### 现状
- `StaffPanel` 把所有学生的提交**平铺展开**（每个学生一个块，正文、附件、OCR、批改表单全摊开），教师没有「点进去看详情」的入口，提交多了很乱。

### 要改什么
- 把 `StaffPanel` 改成「**每学生一条摘要行 → 点击展开详情**」的交互：
  - 摘要行显示：学生邮箱、提交时间、是否迟交、是否已评分（有分数可顺手显示）。
  - 点开详情才显示：正文全文、附件链接、OCR 按钮、图片识别文字、批改表单（分数 + 反馈 + 保存）。
- 数据结构不用动，`submissions` 已经含 `content / media_urls / ocr_text / feedback / score`，只是改组件交互（加一个 `openId` state 控制展开即可）。
- 保持现有「已交 X/Y」和「未交名单」不动，只改提交列表的呈现方式。

---

## 相关文件清单

| 文件 | 作用 |
|---|---|
| `src/app/teaching/[id]/assignments/WrittenAssignments.tsx` | 笔头作业前端（发布/提交/批改/OCR 都在这） |
| `src/app/api/classrooms/[id]/assignments/route.ts` | 列表 + 发布接口（要加附件） |
| `src/app/api/classrooms/[id]/assignments/[assignmentId]/submit/route.ts` | 学生提交（附件上传写法可参考） |
| `src/app/api/classrooms/[id]/assignments/[assignmentId]/review/route.ts` | 教师批改 |
| `src/app/api/classrooms/[id]/assignments/[assignmentId]/ocr/route.ts` | 教师提取图片文字 |
| `src/app/api/classrooms/[id]/assignments/_auth.ts` | 共享鉴权 `getClassroomRole` |
| `db/migrate_assignments.sql` | 笔头作业表 |
| `db/migrate_storage_assignments.sql` | 附件桶 + 存储策略（RLS 要改） |

## 提醒
- 改完执行 `npm run lint` 和 `npm run build` 确认通过。
- 迁移 SQL 写进 `db/` 下新文件，并同步更新 `DEV_LOG.md`。
- 附件路径务必统一 `{assignment_id}/{user_id}/{文件名}`，别破坏现有存储策略对路径段的假设。
