# HablaYa — 西语「输入→输出」训练平台

面向中文母语西语学习者的 Web 应用：把读过的材料自动转化成「能说会用」的语料库，并围绕它做口语对话、AI 润色、跟读等输出训练。

## 技术栈

- **前端/后端**：Next.js（App Router）+ React + Tailwind CSS
- **数据库**：Supabase（云端 PostgreSQL）
- **AI**：DeepSeek（语料分析、对话、润色）
- **语音**：阿里云智能语音交互 NLS（ASR 语音识别 / TTS 语音合成）

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env.local
# 编辑 .env.local，填入真实密钥（见下方「环境变量」）

# 3. 初始化数据库（见下方「数据库」）

# 4. 启动开发服务器（端口 3100）
npm run dev
# 浏览器打开 http://localhost:3100
```

> Windows 下也可双击 `start-hablaya.bat` 一键启动（后台最小化运行）。

## 环境变量

复制 `.env.example` 为 `.env.local` 后填写。`.env.local` 已被 `.gitignore` 忽略，**切勿提交**。

| 变量 | 用途 | 获取位置 |
|------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | 数据库地址 | Supabase 控制台 → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 数据库匿名密钥（可公开分发） | 同上 |
| `DEEPSEEK_API_KEY` | 大模型 | DeepSeek 开放平台 → API Keys |
| `ALIYUN_ACCESS_KEY_ID` | 阿里云鉴权 | 阿里云 RAM → 子账号 AccessKey |
| `ALIYUN_ACCESS_KEY_SECRET` | 阿里云鉴权 | 同上 |
| `ALIYUN_APP_KEY` | 语音项目 AppKey | 智能语音交互控制台 → 项目功能配置 |
| `ALIYUN_TTS_VOICE` | TTS 发音人（可选） | 默认 `Camila`（西语女声） |

> ⚠️ 安全约定：`ALIYUN_ACCESS_KEY_SECRET` 是高危密钥，应使用 **RAM 子账号**的 AccessKey（只授语音/翻译权限），不要使用主账号密钥，也不要明文发到聊天。

## 数据库初始化

数据库结构在 `db/` 目录，按顺序在 Supabase SQL Editor 里执行：

1. `db/schema.sql`（基础表结构）
2. 其余 `db/migrate_*.sql`（迁移，按文件名顺序执行）

## 部署（Vercel）

1. 将仓库推送到 GitHub/Gitee。
2. 在 [Vercel](https://vercel.com) 导入该仓库，Next.js 会自动识别。
3. 在 Vercel → Settings → Environment Variables 填入上表全部环境变量。
4. 部署完成后每次 `git push` 自动更新线上站点。

## 协作约定

- 密钥统一放在 `.env.local`，不进入 Git。
- 阿里云、Supabase、DeepSeek 均通过各自的**团队/成员/子账号**授权，方便随时收回权限。
- 代码改动走分支 + PR，评审后合并。
