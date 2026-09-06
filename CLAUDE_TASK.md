# 写作模块开发任务书（给 Claude Code）

> 把本文档全文粘贴给 Claude Code，让它先读仓库后再开始开发。你是 LinguaLab 项目的开发者，负责「写作」相关模块。

## 一、项目背景（先了解）

LinguaLab 是一个面向中文母语者的外语学习平台，界面为中文，学习目标语言为西班牙语/英语（通过 `TargetLang` 参数化）。技术栈：Next.js 16（App Router）+ React + Tailwind + Supabase（数据库/认证）+ DeepSeek（大模型）+ 阿里云 NLS（语音）。

**开始前，请先读这几个文件**：
- `AGENTS.md`（项目约定）
- `HANDOFF.md`（分工说明，重点看第 7、9 节）
- `DEV_LOG.md`（项目现状）
- `src/lib/auth.ts`、`src/lib/supabase/server-auth.ts`、`src/lib/ai/deepseek.ts`、`src/lib/ai/practice.ts`、`src/lib/language.ts`
- `src/components/InterpretingPractice.tsx`、`src/app/practice/page.tsx`（现有「口语→错题本」闭环，你要参照它）

## 二、你的任务（三块）

### 任务 A：写作润色（自学模式）

在 `src/app/polish/page.tsx`（现在是占位页）实现：
1. 用户输入：作文题目、作文正文、评分标准（可选）。
2. 调新接口（建议 `POST /api/polish`），AI 返回两类内容：
   - **语法纠错/润色建议**：结构对齐 `practice.ts` 里的 `PolishItem`（字段 `original / revised / reason / example / error_type / wrong / correct`），方便直接进错题本。
   - **整体评分反馈**：分维度打分 + 简短点评。
3. 前端展示纠错建议列表（每条带勾选框）+ 评分区。
4. 勾选的建议 → 调用现有 `POST /api/mistakes` 加入错题本（body：`{items:[{error_type, wrong, correct, example, note}]}`）。

### 任务 B：错题本升级为「口译 / 笔译」

改 `src/app/mistakes/page.tsx` 和 `src/components/InterpretingPractice.tsx`：
1. 点「练习」后先出现两个选项：**口译** / **笔译**，选完再出中文句子。
2. **口译**：中文短句（短一点），沿用现有逻辑。
3. **笔译**：中文长句（更长更难），判题重点评价**句式选择、用词准确性（词性、词义是否准确生动）**。
4. 翻译完立刻给反馈。笔译的提示词/评价标准要单独写（可参考 `practice.ts` 里的 `generateInterpretingPrompt` / `evaluateInterpreting`，做带 `mode` 参数的笔译变体，放新文件 `src/lib/ai/writing.ts`）。

### 任务 C：教学笔头作业（教学模式）

入口在 `src/app/teaching/[id]/assignments/page.tsx`（已存在，里面有「必读文章」，你在同一页**新增「笔头作业」区块**）：
1. **教师端**：发布笔头作业（题目 + 截止时间）。
2. **学生端**：查看作业、提交作业（粘贴文字 / 上传图片 / 音频 / 视频）。
3. **教师端**：查看提交、图片提取文字（OCR）、写反馈。
4. **留档**：记录未交名单 + 作业评分留档。
5. 新表写进 `db/migrate_assignments.sql`（建议 `classroom_assignments` + `assignment_submissions` 两张表）。
6. 「AI 自动批改」先不做，只做人工批改 + 留档。

## 三、必须遵守的铁律

1. **前端调 API 用 `apiFetch`**（`import { apiFetch } from "@/lib/auth"`），不要用原生 `fetch`。
2. **后端鉴权用 `getUserClient`**：`const auth = await getUserClient(request); if (!auth) return unauthorized();`，然后 `auth.client`（带用户上下文的 Supabase 客户端）、`auth.user.id`、`auth.user.lang`。
3. **用户数据按 `user_id` 隔离**：查询加 `.eq("user_id", userId)`，插入加 `user_id: userId`。
4. **学习语言用 `TargetLang` 参数化**：`langMeta(lang).label` 得到「西班牙语/英语」，AI 提示词里涉及语言的地方都用它拼，**禁止硬编码「西语/西班牙语/英语」**。
5. **调 AI 用现成封装**：`chatJSON`（结构化 JSON）、`chatText`（纯文本），从 `src/lib/ai/deepseek.ts` 导入。
6. **新增 AI 函数放新文件 `src/lib/ai/writing.ts`**，不要改 `practice.ts`（那是负责人负责的文件）。
7. **新增数据库表**：SQL 写 `db/migrate_xxx.sql`；用户表要有 `user_id`；班级共享表隔离在应用层。
8. **界面风格**：中文文案、圆角 `rounded-xl`、主色 `orange-600`，参考现有页面。
9. **别碰这些文件**（负责人负责）：`src/app/practice/**`、教学口语训练/课外阅读追踪/排行相关文件。

## 四、开发流程

1. 确保在 `feature/writing` 分支上开发。
2. 按「任务 A → B → C」顺序做，先做写作润色（最独立、最快见效），跑通再往下。
3. 每完成一块，自己 `npm run lint` 和 `npm run build` 验证。
4. 遇到 OCR、文件上传（Supabase Storage）这两个依赖，先停下问负责人怎么选，别自己拍板。

## 五、第一步

先做**任务 A（写作润色）**：读 `src/app/api/practice/polish/route.ts` 和 `src/app/practice/page.tsx` 里的「结束对话→润色→加入错题本」流程，然后照它的结构，在 `src/app/polish/page.tsx` 和新的 `src/app/api/polish/route.ts` 实现写作润色。完成后告诉我结果。
