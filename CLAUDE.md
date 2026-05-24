# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目定位

**rehudex**(目录名 easyAgent) — TypeScript 写的终端 AI 助手 CLI,对接任意兼容 OpenAI SDK 的 LLM endpoint(DeepSeek / 智谱 / Ollama / 小米 mimo 等)。具备流式输出、终端 Markdown 渲染、工具调用闭环、JSONL 会话持久化。已发布到 npm。

入口:`src/index.ts` → `bin: rehudex`(`dist/index.js`)。

## 常用命令

```bash
pnpm install          # 装依赖(必须 pnpm,有 pnpm-workspace.yaml + pnpm-lock.yaml)
pnpm dev              # tsx 直跑源码(开发主用)
pnpm build            # tsc → dist/
pnpm start            # node dist/index.js

# 项目内没有 lint / test。改完跑一次 pnpm build 确认 TS 编译通过即可。
```

启动需要 `LLM_API_KEY`(项目根 `.env` 或 `~/.rehudex/.env`)。详见 README.md 配置章节。

## 架构速览

REPL 主循环位于 `src/index.ts`,对用户输入按前缀分发:

| 输入 | 处理 | 文件 |
|---|---|---|
| `!cmd` | 直接执行 shell,结果入 history(跳过确认) | `shellExec.ts` |
| `/cmd args` | 查 SlashCommand 注册表 | `commands.ts` |
| `@path` 出现在输入里 | 提交时内联展开为附件文本 | `completer.ts` |
| Tab | 同步 completer:`/` 补命令、`@` 补路径 | `completer.ts` |
| 其余 | 走 `agentRun()` 多轮工具调用循环 | `agent.ts` |

两个注册表:
- **Tool**(`src/tools/index.ts`)— LLM 通过 function calling 调用,有 3 个内置工具
- **SlashCommand**(`src/commands.ts`)— 用户用 `/xxx` 直接触发,例 `/new` `/list` `/load` `/help` `/clear`

详细的循环结构、文件分工、关键不变量见 [.claude/docs/architecture.md](.claude/docs/architecture.md)。

## 改动时务必注意

- **所有文件操作必须经过 `src/tools/safePath.ts`**,防止越出 cwd。新增的文件类工具一定要走它。
- **ESM 导入必须带 `.js` 后缀**(即便源码是 `.ts`),例 `import { foo } from "./bar.js"`。tsconfig 用 `moduleResolution: Bundler`,但运行/打包都是 ESM。
- **readline completer 必须同步**(arity=1,直接 `return [hits, line]`)。Node 24 的 `readline/promises` 异步回调路径有 bug,会在 `_tabCompleter` 解构 undefined 时崩。详见 [.claude/docs/architecture.md](.claude/docs/architecture.md) 的"补全器"节。
- **shell 命令探测在 `src/shellExec.ts`** — Windows 按 pwsh → powershell → cmd 顺序回退。`!` 前缀和 `execute_shell` 工具共用 `runShell()`,改 shell 逻辑改这一个地方。
- **会话写入是 append-only JSONL**(`src/session.ts`),每条消息单行 JSON。不要做替换/重写式更新。
- **不要写 .md 等文档文件**,除非用户明确要求。

## 子文档

- [.claude/docs/architecture.md](.claude/docs/architecture.md) — REPL/Agent 循环、注册表、会话、流式渲染、补全器细节
- [.claude/docs/conventions.md](.claude/docs/conventions.md) — TS / ESM / 提交信息 / 工具与命令的添加方式
- [docs/publishing.md](docs/publishing.md) — npm 发版流程(`npm version` + 2FA + OTP)
- [docs/debugging.md](docs/debugging.md) — 抓包(`HTTPS_PROXY` + `NODE_EXTRA_CA_CERTS`)
- [README.md](README.md) — 面向最终用户的安装/配置/使用文档
