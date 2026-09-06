# 开发交接说明

> 给你负责的两块功能 + 项目约定。先通读一遍再动手。

---

## 一、你负责的功能

1. **自学模式：写作润色 + 错题本升级**
   - 写作润色：用户给题目、粘贴作文、附评分标准（可选），AI 生成语法纠错 + 评分反馈，支持勾选建议加入错题本。
   - 错题本升级：练习从「口译」升级为「口译 / 笔译」两个选项。

2. **教学模式：笔头作业板块**
   - 教师发布作业（题目 + 截止时间），学生提交（文字/图片/音频/视频），教师查看、图片提取文字、写反馈；记录未交名单 + 评分留档。

> 注意：**小程序先不做**。教学模式的「口语训练 / 课外阅读追踪 / 排行」由负责人做，你不要碰。

---

## 二、开始前

1. clone 仓库到本地（负责人给你地址）。
2. 复制 `.env.example` 为 `.env.local`，填入密钥（负责人单独发你）。
3. `npm install` → `npm run dev`（端口 3100）。
4. 先读根目录的 `AGENTS.md`（项目约定）。

---

## 三、技术栈与关键约定（务必遵守）

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | Next.js 16 App Router + React + Tailwind | 界面文案中文 |
| 后端 | Next.js API Routes | `src/app/api/...` |
| 数据库 | Supabase（Postgres）+ Auth | 迁移 SQL 放 `db/` |
| 大模型 | DeepSeek | 封装在 `src/lib/ai/deepseek.ts` |

### 必须遵守的几条

1. **前端调 API 用 `apiFetch`**（不是 `fetch`）。它自动带登录 token。
   ```ts
   import { apiFetch } from "@/lib/auth";
   const res = await apiFetch("/api/xxx", { method: "POST", headers: {...}, body: JSON.stringify({...}) });
   ```

2. **后端鉴权用 `getUserClient`**，拿用户 id：
   ```ts
   import { getUserClient, unauthorized } from "@/lib/supabase/server-auth";
   const auth = await getUserClient(request);
   if (!auth) return unauthorized();
   const supabase = auth.client;   // 带用户上下文的客户端
   const userId = auth.user.id;    // 用户 id
   ```
   所有按用户隔离的查询/写入都要带 `user_id`（`eq("user_id", userId)`，插入时 `user_id: userId`）。

3. **语言不再存账户**，改为「按素材自动识别」，别硬编码「西语/西班牙语/英语」。
   ```ts
   import { detectLanguage, langMeta, type TargetLang } from "@/lib/language";
   const lang = detectLanguage(text);        // 自动判定 "es" | "en"
   const name = langMeta(lang).label;        // "西班牙语" / "英语"
   ```
   语料 `materials.lang`、班级 `classrooms.lang`、错题 `mistake_book.lang` 存检测结果；AI 提示词里涉及语言的地方用 `langMeta(lang).label` 动态拼。

4. **调 AI 用现成封装**：
   ```ts
   import { chatJSON, chatText } from "./deepseek";
   const result = await chatJSON<{foo?: string}>(messages);   // 结构化 JSON 输出
   const text = await chatText(messages);                       // 纯文本输出
   ```
   AI 提示词里涉及「西语/英语」的地方都要用 `langMeta(lang).label` 动态拼。

5. **新增数据库表**：建表 SQL 写进 `db/` 下的新 `migrate_xxx.sql`，并在 Supabase SQL Editor 执行。用户数据表要有 `user_id uuid`；教学班级相关表是共享表，隔离在应用层（API 里按成员关系过滤，参考现有 `classroom_*` 表）。

6. **界面风格**：参考现有页面（圆角 `rounded-xl`、橙色主色 `orange-600`、Tailwind）。

---

## 四、现有「口语 → 错题本」流程（你要镜像的）

这是你写作润色要参照的现有闭环，涉及文件：

- `src/app/practice/page.tsx`：口语练习页，对话结束后 `finish()` 调 `/api/practice/polish`。
- `src/app/api/practice/polish/route.ts`：润色接口，返回 `{ polish: PolishItem[] }`。
- `src/app/api/mistakes/route.ts`：错题本的 GET（列表）/ POST（批量加入）。
- `src/app/mistakes/page.tsx`：错题本列表页 + 「口译练习」入口。
- `src/components/InterpretingPractice.tsx`：口译练习组件（做题 + 反馈）。
- `src/app/api/mistakes/practice/route.ts` + `answer/route.ts`：口译练习抽题 + 判题。

**流程**：
1. 口语对话结束 → `POST /api/practice/polish`（body `{history}`）→ 返回润色建议列表。
2. 每条建议是 `PolishItem`：
   ```ts
   { original, revised, reason, example, error_type, wrong, correct }
   ```
3. 前端展示建议列表，每条带勾选框；用户勾选后点「加入错题本」→ `POST /api/mistakes`（body `{items: [{error_type, wrong, correct, example, note}]}`）→ 写入 `mistake_book` 表。
4. 错题本页列出来；点「口译练习」→ `GET /api/mistakes/practice` 抽一条错题 + 生成中文短句 prompt → 用户翻译作答 → `POST /api/mistakes/practice/answer` 判题、给反馈、累计连续答对次数。

`mistake_book` 表字段：`id, user_id, error_type, wrong, correct, example, note, wrong_count, correct_streak, last_reviewed_at, created_at`。

---

## 五、任务一：写作润色 + 错题本升级

### 5.1 写作润色

- 新建/改写 `src/app/polish/page.tsx`（现在是占位 `Placeholder`）。
- 输入：作文题目、作文正文、评分标准（可选）。
- 调一个新接口（建议 `POST /api/polish`），AI 返回两类内容：
  1. **语法纠错/润色建议**（结构对齐上面的 `PolishItem`，方便直接进错题本）。
  2. **整体评分反馈**（分维度打分 + 简短点评，结构你自定）。
- 前端展示纠错建议列表（带勾选）+ 评分区。
- 勾选的建议 → `POST /api/mistakes`（复用现有错题本接口，字段照搬）。

> 参照现有 `polishAnswers`（在 `src/lib/ai/practice.ts`）的写法，但要按「写作」场景调整提示词（题目、评分标准、作文长度）。

### 5.2 错题本升级：口译 / 笔译

- 改 `src/app/mistakes/page.tsx` 和 `src/components/InterpretingPractice.tsx`。
- 点「练习」后先出现两个选项：**口译** / **笔译**，用户选完再出中文句子（和现在一样出题）。
- **口译**：中文短句（短一点），和现在差不多。
- **笔译**：中文长句（更长、更难），判题时重点评价：**句式选择、用词准确性（词性、词义是否准确、生动）**。
- 翻译完立刻给反馈（复用现有 answer 流程，但笔译的提示词/评价标准要单独写）。
- 建议在 `src/lib/ai/practice.ts` 里新增 `generateInterpretingPrompt` / `evaluateInterpreting` 的「笔译」变体（带 `lang` 和 `mode: "interpret" | "translate"` 参数），避免改坏现有口译逻辑。

---

## 六、任务二：教学笔头作业板块

### 6.1 功能规格

- **教师端**：进班级后「发布笔头作业」——题目（作文题或翻译句）+ 截止时间 → 发布。
- **学生端**：看到作业、提交作业。提交形式：**粘贴文字 / 上传图片 / 音频 / 视频**。
- **教师端**：查看每个学生的提交；**图片支持提取文字**；给作业写反馈。
- **数据留档**：记录「哪些同学在截止时间内没交」，作业评分/反馈留档，方便期末平时分。
- **学生档案**：题目要求 + 学生作业 + 老师反馈，由 AI 合并成学生档案的一部分；每次作业可回顾（这部分的 AI 批改逻辑等走访老师后再定，先把「收发作业 + 留档」做通）。

### 6.2 数据模型建议（新表，写进 db/migrate_assignments.sql）

```sql
classroom_assignments (
  id, classroom_id, title text, content text, ends_at timestamptz,
  created_by uuid, created_at timestamptz
)

assignment_submissions (
  id, assignment_id, user_id, content text, media_url text,  -- 文字/文件链接
  feedback text, score text, submitted_at timestamptz
)
```

- 提交文件（图片/音频/视频）建议用 **Supabase Storage** 存，链接存 `media_url`。
- 未交名单：`classroom_members`（已通过）减去 `assignment_submissions` 里已提交的 user_id。

### 6.3 需要你和负责人确认的技术依赖

1. **图片提取文字（OCR）**：现有后端没有 OCR 能力。可选阿里云 OCR（负责人有阿里云账号），或换一个带视觉能力的模型。**先和负责人确认用哪家再写。**
2. **音频/视频上传**：用 Supabase Storage（负责人会给你对应 bucket 权限/配置）。
3. 作业的「AI 批改」先不做，只做人工批改 + 留档。

---

## 七、文件归属（避免和负责人冲突）

**你负责（只碰这些）**：
- `src/app/polish/page.tsx`（写作润色页）
- 新的 `src/app/api/polish/route.ts`
- `src/app/mistakes/page.tsx`、`src/components/InterpretingPractice.tsx`（口译/笔译升级）
- `src/app/api/mistakes/*`（如需扩展）
- 教学作业：`src/app/teaching/[id]/assignments/page.tsx`（**已有**，往里加「笔头作业」区块）+ 新的 `src/app/api/classrooms/[id]/assignments/**`
- 新的 AI 函数建议放**新文件** `src/lib/ai/writing.ts`（别改 `practice.ts`，避免冲突）
- 新的 `db/migrate_assignments.sql`

> 注意：班级现在是「仪表盘 + 三个子页」结构（见文末速查），`/teaching/[id]/assignments` 里已有「必读文章」，你是在同一个页面**新增**「笔头作业」区块，不是新建页面。

**负责人负责（你别碰）**：`src/app/practice/**`、教学口语训练/课外阅读追踪/排行相关文件。

**共享文件**（`Navbar.tsx`、`src/lib/ai/practice.ts`、`src/lib/language.ts` 等）：改之前先和负责人说一声，避免同时改。

---

## 八、Git 流程

```
git checkout -b feature/writing-mistakes    # 或 feature/assignments
# 开发、commit
git checkout main && git pull
git checkout 你的分支 && git merge main      # 合并前先同步
# 完成后 push，让负责人 review 后合并 main
```

- 分支**短**（几天内合一次），别拖成几周。
- 只提交代码，**不要提交 `.env.local`、密钥、docx/pdf 等**。
- 遇到需要改共享文件的，先在群里和负责人确认。

---

## 九、项目速查（数据模型 & 关键文件）

### 9.1 现有数据库表

| 表 | 作用 | 关键字段 |
|----|------|---------|
| `materials` | 自学语料库原始材料 | `id, user_id, title, raw_text, tags, cefr_level, translation` |
| `corpus_cards` | 语料卡片 | `id, user_id, material_id, category(keyword/expression/prompt), content, zh, extra, status` |
| `annotations` | 语料原文高亮/批注 | `id, user_id, material_id, text, color, note` |
| `mistake_book` | 错题本 | `id, user_id, error_type, wrong, correct, example, note, wrong_count, correct_streak, last_reviewed_at` |
| `classrooms` | 班级 | `id, name, invite_code, created_by` |
| `classroom_members` | 班级成员 | `id, classroom_id, user_id, email, role(teacher/leader/student), status(pending/approved)` |
| `classroom_readings` | 班级必读文章 | `id, classroom_id, title, raw_text, starts_at, ends_at, created_by` |
| `reading_annotations` | 必读文章勾画批注 | `id, reading_id, user_id, text, color, note` |

> 用户数据表用 `user_id` 隔离（RLS + API 层过滤）；班级相关表是共享表，隔离在应用层（按成员关系过滤）。

### 9.2 关键文件

| 文件 | 作用 |
|------|------|
| `src/lib/auth.ts` | `apiFetch`、`useAuth`、`useUserInfo`、`signIn/signUp` |
| `src/lib/supabase/server-auth.ts` | `getUserClient(request)` → `{client, user:{id, email}}`、`unauthorized()` |
| `src/lib/ai/deepseek.ts` | `chatJSON`（结构化 JSON）、`chatText`（纯文本） |
| `src/lib/ai/practice.ts` | 口语：`chatReply`、`polishAnswers`、`generateInterpretingPrompt`、`evaluateInterpreting` |
| `src/lib/language.ts` | `TargetLang`、`detectLanguage`、`langMeta(lang).label/short`、`PRODUCT_NAME` |
| `src/app/practice/page.tsx` | 口语练习（自由练习 + 考题模式），含「对话→润色→错题本」闭环 |
| `src/components/InterpretingPractice.tsx` | 错题本口译练习组件（你要升级成口译/笔译） |

### 9.3 教学模式页面结构（负责人已搭好）

```
/teaching                        # 教学模式首页：我的班级 + 创建/加入班级
/teaching/[id]                   # 班级仪表盘：三张入口卡片（班级成员 / 发布作业 / 口语练习）
/teaching/[id]/members           # 班级成员（审批、班委/教师）
/teaching/[id]/assignments       # 发布作业（必读文章已实现 + 笔头作业占位，你在这里加笔头作业）
/teaching/[id]/speaking          # 口语练习（占位，负责人后续做）
/teaching/[id]/readings/[rid]    # 必读文章阅读页（勾画批注）
```

---

有问题随时在群里问，尤其 OCR 和文件上传这两块，先对齐再写。
