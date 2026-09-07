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

## 问题三：笔头作业改成「列表 → 作业详情 → 单个学生批改」三级页面（类似必读文章）

### 现状
- `WrittenAssignments.tsx` 把**列表 + 发布 + 每个作业的完整详情（正文、附件、学生提交、批改、OCR）全部平铺在同一个页面**，点开列表页就直接看到/修改所有提交，太乱。

### 要改什么
改成类似「必读文章」的**三级页面**结构：

1. **列表页**（`src/app/teaching/[id]/assignments/page.tsx` 里的「笔头作业」区）：
   - 每篇作业只显示一个**标题卡片**（标题 + 截止时间 + 进行中/已截止 + 教师看已交数、学生看已提交/未提交），点击跳转到作业详情页 `/teaching/[id]/assignments/[assignmentId]`。
   - 「发布笔头作业」入口保留在列表页（教师）。

2. **作业详情页**（新建 `src/app/teaching/[id]/assignments/[assignmentId]/page.tsx`）：
   - 展示作业正文 + 教师附件链接。
   - **教师端**：显示**学生列表，分为「已提交」和「未提交」两组**（已提交组里显示该学生是否已批改/评分情况），点击某个已提交学生 → 进入三级批改页。
   - **学生端**：提交表单（文字 + 附件）+ 查看自己的提交、评分、教师反馈。

3. **单个学生批改页**（三级页面，可新建 `/teaching/[id]/assignments/[assignmentId]/[userId]` 或弹层，按你实现习惯定）：
   - 展示该学生的提交正文 + 附件 + OCR。
   - **批改入口在这里**：等级评分 + 反馈 + 保存。
   - 批改保存后，返回学生列表时能看到该学生的最新评分。

### 技术提示
- 提交/批改/OCR 接口都已存在：`POST .../submit`、`POST .../review`、`POST .../ocr`（`review` 里的评分字段要随问题四一起改成等级制）。
- 数据：现有 `GET /api/classrooms/[id]/assignments` 已返回 `assignments + submissions + recipients + my_role + server_now`，详情页/批改页可直接复用它并过滤到单个 `assignmentId`；若想更干净，也可以新增 `GET .../assignments/[assignmentId]` 详情接口。
- 把 `WrittenAssignments.tsx` 里的详情逻辑（学生提交表单、批改、OCR）迁到对应页面，列表只留标题卡片和发布表单。

---

## 问题四：评分从「数字」改为「等级制」（A / A+ / B …）

### 现状
- `assignment_submissions.score` 是 `numeric(6,2)`、`max_score` 默认 100，教师批改填 0~100 的数字分数。

### 要改什么
- 评分改成**字母等级制**，例如 A+ / A / B+ / B / C+ / C / D（具体档位你定，但至少要有 A、A+、B 这类）。
- 涉及改动：
  - **数据层**：`assignment_submissions` 的评分字段改为存等级（建议把 `score` 改成 `text`，或新增 `grade text` 字段保留原 `score` 兼容，迁移写进新 `db/migrate_assignments_grade.sql`）。
  - **接口层** `POST .../review`：入参从 `score`（数字）改为 `grade`（等级字符串），并做枚举校验（只允许约定的等级）。
  - **前端**：批改入口的分数输入框改成等级选择（下拉或按钮组）；学生列表/学生端展示也改成等级（如「评分：A」）。

### 注意
- 和问题三的批改页一起做，批改保存后学生列表要能看到最新等级评分。
- 若之前已有数字评分的历史数据，迁移时要么保留旧字段做兼容、要么给个默认等级，别让老数据报错。

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

---

# 新增三大功能（全部「类比必读文章」模块，请照抄其结构）

> 以下三块是笔头作业接下来要补的核心能力，都已有现成的「必读文章」实现可直接对照。
> 「必读文章」模块是我方实现并已上线，代码路径如下，动手前请先通读一遍：
> - 多级页面：`src/app/teaching/[id]/readings/...`（列表在 `src/app/teaching/[id]/assignments/page.tsx` 里的「必读文章」区，详情 `readings/[readingId]/page.tsx`，题目 `questions/[questionId]/page.tsx`，批改 `questions/[questionId]/answers/[answerId]/page.tsx`，分析 `readings/[readingId]/analysis/page.tsx`）
> - 通知系统：`src/lib/notifications.ts` + `db/migrate_notifications.sql` + `src/app/api/notifications/route.ts` + `src/app/notifications/page.tsx`
> - 作答分析：`src/lib/ai/analysis.ts`（`analyzeReadingClass`）+ `src/app/api/classrooms/[id]/readings/[readingId]/analysis/route.ts` + 上面的 analysis 页面
>
> 笔头作业现有相关文件（你实现的部分）：`WrittenAssignments.tsx`、`assignments/route.ts`、`[assignmentId]/submit|review|ocr/route.ts`、`db/migrate_assignments.sql`、`db/migrate_assignments_attachments.sql`、`db/migrate_assignments_grade.sql`。

---

## 功能一：笔头作业多级页面（类比必读文章）

### 目标结构
| 层级 | 必读文章（对照） | 笔头作业（要做） |
|---|---|---|
| 列表 | `assignments/page.tsx` 里「必读文章」标题卡片 | 同文件里「笔头作业」标题卡片（`WrittenAssignments` 只保留列表） |
| 详情 | `/teaching/[id]/readings/[readingId]` | 新建 `/teaching/[id]/assignments/[assignmentId]` |
| 单生批改 | `/teaching/[id]/readings/[readingId]/questions/[questionId]/answers/[answerId]` | 新建 `/teaching/[id]/assignments/[assignmentId]/[userId]`（或按 submission id） |
| 分析 | `/teaching/[id]/readings/[readingId]/analysis` | 新建 `/teaching/[id]/assignments/[assignmentId]/analysis`（见功能三） |

### 要点
- **列表页**：`WrittenAssignments.tsx` 现在把「列表 + 发布 + 每个作业详情 + 提交 + 批改 + OCR」全平铺在一个组件里，请拆成「标题卡片列表」+「发布表单」，卡片点击跳详情页。
- **详情页（教师端）**：作业正文 + 教师附件；学生列表分「已提交 / 未提交」两组，已提交组显示是否已批改/评分，点击进入单生批改页。
- **详情页（学生端）**：提交表单（文字 + 附件）+ 自己的提交、评分、反馈。
- **单生批改页**：该生提交正文 + 附件 + OCR + 等级评分 + 反馈保存；保存后返回详情页能看到最新评分。
- 数据与接口已具备（`GET .../assignments` 已返回 `assignments + submissions + recipients + my_role + server_now`，`submit/review/ocr` 已存在），主要是**拆页面**，可新增 `GET .../assignments/[assignmentId]` 详情接口让详情页更干净。
- 此条即为上文「问题三」的正式落地（问题四的等级制评分一并在这里的批改页做）。

---

## 功能二：笔头作业通知系统（类比必读文章）

### 必读文章的通知触发链路（照抄）
1. 学生提交作答 → `questions/[questionId]/answer/route.ts` 里调 `notifyTeachers(...)` 通知老师。
2. 老师批改 → `questions/[questionId]/answers/[answerId]/feedback/route.ts` 里调 `notifyStudent(...)` 通知学生。
- 库函数：`src/lib/notifications.ts`（`notifyTeachers` / `notifyStudent`）。
- 数据表：`notifications`（`user_id / type / classroom_id / reading_id / title / read / created_at`，`type` 目前 `check (type in ('submission','feedback'))`）。
- 前端：`src/app/api/notifications/route.ts`（列表 + 全部已读）、`src/app/notifications/page.tsx`（点击 `open()` 跳 `/teaching/{classroom_id}/readings/{reading_id}`）。

### 笔头作业要做三条通知
1. **老师发布作业 → 提醒所有学生**（新通知类型）。
2. **学生完成提交 → 提醒老师批改**。
3. **老师批改完成 → 提醒学生查看批改结果**。

### 要改什么
- **数据层**（新建 `db/migrate_assignments_notifications.sql`）：
  - `notifications` 加一列 `assignment_id uuid`（与现有 `reading_id` 并列，用来深链到作业）。
  - 放宽 `type` 校验，加入新类型，建议 `type in ('submission','feedback','new_assignment')`（或新增 `assignment` 类别，你定，但要能和 reading 通知区分）。改 check 约束需 `drop constraint` 再重建，注意表名是 `public.notifications`。
- **库函数**：在 `src/lib/notifications.ts` 里新增三个（或把现有函数参数化，别破坏 reading 调用）：
  - `notifyAssignmentStudents(supabase, classroomId, assignmentId, title)`：向 `assignment_recipients`（或班级所有学生）插 `type='new_assignment'`。
  - `notifyAssignmentTeacher(...)`：学生提交后插 `type='submission'`（老师本人）。
  - `notifyAssignmentStudent(...)`：批改后插 `type='feedback'`（该生 user_id）。
  - 关键：这三条**都写 `assignment_id`、不写 `reading_id`**，与必读文章的通知严格区分。
- **挂点**：
  - 发布：`assignments/route.ts` 的 `POST` 在写入 `assignment_recipients` 之后调用「提醒学生」。
  - 提交：`[assignmentId]/submit/route.ts` 的 `POST` 在 upsert submission 之后调用「提醒老师」。
  - 批改：`[assignmentId]/review/route.ts` 的 `POST` 在 update 之后用 `submission.user_id` 调用「提醒学生」。
- **前端**：`src/app/notifications/page.tsx` 的 `open()` 目前只处理 `reading_id`，要加分支：当 `assignment_id` 存在时跳 `/teaching/{classroom_id}/assignments/{assignment_id}`（详情页做好后指向它）。`Notification` interface 加 `assignment_id` 字段。

---

## 功能三：笔头作业作答分析（类比必读文章，重点：数据隔离）

### 必读文章的分析实现（照抄结构，别复用数据）
- AI 函数：`src/lib/ai/analysis.ts` 的 `analyzeReadingClass`，输入为文章标题 + 题目列表 + 每个学生的 {答案 + 教师批注 + 勾画/提问批注}，输出 `{ classSummary, students: [{email, summary}] }`。
- 接口：`src/app/api/classrooms/[id]/readings/[readingId]/analysis/route.ts`（仅教师），生成后把 `classSummary` 回写到 `classroom_readings.class_summary` + `class_analysis_at`。
- 页面：`src/app/teaching/[id]/readings/[readingId]/analysis/page.tsx`（进入即自动生成，展示班级总体 + 每个学生情况）。

### 笔头作业要做
- 新建 `src/lib/ai/assignment-analysis.ts`（或把 `analysis.ts` 参数化，但**建议单独写一个函数**），输入为：作业标题/要求 + 每个学生的 {提交正文/OCR 文字 + 教师批注(反馈/等级)}，输出同款 `{ classSummary, students }`。
- 新建接口 `POST /api/classrooms/[id]/assignments/[assignmentId]/analysis`（仅教师），生成后回写 `classroom_assignments.class_summary` + `class_analysis_at`。
- 新建页面 `src/app/teaching/[id]/assignments/[assignmentId]/analysis/page.tsx`，进入即自动生成、展示总体 + 学生列表。
- 教师端作业详情页放「班级作答分析」入口（类比阅读页顶部入口）。

### 数据隔离（务必严格遵守）
- 笔头作业分析**只读** `assignment_submissions`（`eq("assignment_id", assignmentId)`），**只写** `classroom_assignments` 的 `class_summary`/`class_analysis_at`。
- **绝不读** `reading_answers` / `reading_annotations`，**绝不写** `classroom_readings`。
- 反过来必读文章分析也保持只针对 `reading_id`。两个板块的 AI 函数、接口、存储列各用各的，做到「每一次分析只针对该篇文章 / 该次作业」。
- 数据层：新建 `db/migrate_assignments_analysis.sql`，给 `classroom_assignments` 加 `class_summary text`、`class_analysis_at timestamptz` 两列（参考 `db/migrate_class_analysis.sql`）。
- 学生邮箱映射：`assignment_submissions` 只有 `user_id` 没有 `email`，喂 AI 前需要把 `user_id` 映射成邮箱（用 `assignment_recipients` 或 `classroom_members`，必读文章分析路由里已有同类 `emailByUser` 映射逻辑可抄）。

---

## 完成标准（三块统一）
1. 多级页面能跑通「列表 → 详情 → 单生批改」完整链路。
2. 三条通知链路全部触发，且通知点击能正确跳到对应作业页面。
3. 作业作答分析能生成并展示，且与必读文章分析数据完全隔离。
4. `npm run lint`、`npm run build` 通过；所有迁移 SQL 放进 `db/` 新文件并执行；同步更新 `DEV_LOG.md`。
