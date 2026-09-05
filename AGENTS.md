<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 项目约定

- 每完成一个「教学模式」功能阶段，在 `DEV_LOG.md` 末尾追加对应小节（用什么方法解决什么问题、完成什么设计），并 commit。
- 界面文案保持中文；学习目标语言（西语/英语）通过 `src/lib/language.ts` 的 `TargetLang` 参数化，勿硬编码「西语/西班牙语」。
- 密钥一律走 `.env.local`（已 gitignore），严禁提交明文密钥。
