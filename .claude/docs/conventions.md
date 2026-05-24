# 代码约定

## TypeScript / ESM

- 源码 `target: ES2022`,`module: ESNext`,`moduleResolution: Bundler`,运行用 `tsx`(dev)或 `node dist/*.js`(prod)。
- **import 必须带 `.js` 后缀**,即便文件是 `.ts`:
  ```ts
  import { foo } from "./bar.js";        // ✅
  import { foo } from "./bar";           // ❌ prod 跑不起来
  ```
- `package.json` 是 `"type": "module"`,没有 CommonJS。
- TypeScript 是 `strict: true`,新代码请尽量保留类型,但需要用第三方非 typed 模块时 `import` 后 `as any` 也可接受(参考 `src/llm.ts` 对 `delta` 的处理)。
- 第三方类型不全的小补丁放 `src/md4x.d.ts` 这类 ambient declaration 文件。

## 添加新的 Tool

1. 在 `src/tools/` 下新建 `xxx.ts`,实现 `Tool` 接口(`src/types.ts`)
2. 文件操作必须 `safePath()`
3. 副作用类操作(写、删、执行)必须先 `confirm(msg)`(`src/confirm.ts`)
4. 在 `src/index.ts` 顶部 `registerTool(xxx)`(注册必须发生在 `agentRun` 被调之前)

参考 `src/tools/readFile.ts`(无副作用)和 `src/tools/shell.ts`(走 confirm + 复用 `runShell`)。

## 添加新的 SlashCommand

直接在 `src/commands.ts` 文件末尾 `registerCommand({ name, description, usage?, run })`。`/help` 会自动按字母序列出。`run` 通过 `ctx` 拿到 history / store / systemMsg / setStore。

如果命令需要切换会话(类 `/new` `/load`),要走 `ctx.setStore(newStore)`,**别直接赋值 `ctx.store = newStore`** —— 外层 `index.ts` 的 `let store` 不会同步。

## 提交信息

按现有 git log 风格(中文为主,Conventional Commits 前缀):

```
feat: 添加 ! / @ 三种输入前缀 + 命令注册表
fix: 移除 devEngines 阻断 npm 命令,清理重复的 type 字段
refactor(config): BASE_URL → LLM_BASE_URL,避开与 Vite/Next.js 等构建工具撞名
docs+config: 重组文档 + 改为「兼容 OpenAI SDK 的 LLM endpoint」定位
release: v0.4.0 — DEEPSEEK_API_KEY / DEEPSEEK_MODEL → LLM_API_KEY / LLM_MODEL
```

前缀:`feat` / `fix` / `refactor` / `docs` / `chore` / `release`。subject 用中文,可在前缀后用括号加 scope。

## 不要做的事

- **不要直接用 `child_process.exec` 跑 shell** — 走 `src/shellExec.ts` 的 `runShell()`,自动带 cwd / timeout / Windows shell 探测
- **不要 `fs.readFile` 没经 safePath 的用户输入路径** — 用 `safePath(p)` 包一层
- **不要往 readline 塞 arity=2 的异步 completer** — Node 24 上会崩,见 [architecture.md](architecture.md) 补全器节
- **不要在会话 JSONL 上做删除/替换** — append-only,要"忘记"上下文用 `/clear` 重写 system message 而非改文件
- **不要在 `.env` 里写 `NODE_EXTRA_CA_CERTS`** — Node TLS 初始化早于 dotenv 加载
