# 架构细节

CLAUDE.md 的扩展,聚焦不读多个文件就看不出来的"大图"。

## REPL 主循环(src/index.ts)

启动 → 加载/创建 `SessionStore`(可选 `-c` 续接最近一次)→ 进入 `while (!closed)` 循环。

每轮分发顺序(命中即 `continue`):

```
exit          → shutdown
!cmd          → runShell + 结果入 history(role=user)
/cmd args     → getCommand(name).run(args, cmdCtx)
其余(可能含 @path)
              → expandAtRefs() 注入文件内容 → agentRun()
```

`cmdCtx: CommandContext` 在循环外构造一次,`setStore` 回调里同时改外层 `let store` 和 `cmdCtx.store`,这样 `/new` `/load` 能切换持久化目标但又不破坏 `history` 数组引用(`history.length = 0; history.push(...)` 原地改)。

## Agent 多轮循环(src/agent.ts)

`agentRun(userInput, history, store)`:

1. push user message → store.append
2. for i in 0..maxIterations(`CFG.maxIterations = 39`):
   - `chatStream(history, tools, onText, onReasoning)` — 流式拉 LLM 响应
   - 渲染状态机:`reasoning` 阶段灰字直出、`content` 阶段走 md4x 实时 Markdown 渲染
   - push assistant message
   - 无 tool_calls → 退出
   - 否则:遍历 tool_calls,`getTool(name).execute(args)`,push `role: tool` 消息(带 `tool_call_id`)
3. 累加 token usage 返回

`chatStream`(`src/llm.ts`)把 OpenAI 的 delta 流装回完整的 `ChatCompletionMessage`,并保留 `reasoning_content` 字段(DeepSeek-R1 / OpenAI o 系列的思考链),供下一轮 round-trip。

## 两个注册表

| 注册表 | 谁触发 | 文件 | 接口 |
|---|---|---|---|
| Tool | LLM(function call) | `src/tools/index.ts` | `{ name, description, parameters, execute(args) }` |
| SlashCommand | 用户(`/xxx`) | `src/commands.ts` | `{ name, description, usage?, run(args, ctx) }` |

`registerTool(t)` / `registerCommand(c)` 都在模块顶层执行,**所以工具/命令模块必须被显式 import 才能注册**:
- 工具在 `src/index.ts` 顶部显式 `registerTool(...)` 三次
- 命令在 `src/commands.ts` 文件末尾自注册,被任何地方 import 即生效

`SlashCommand.run` 拿到的 `CommandContext`:

```ts
{ history, store, systemMsg, setStore(s) }
```

`setStore` 同时改外层 store 和 ctx.store,见上节。

## 会话持久化(src/session.ts)

- 根目录:`~/.rehudex/projects/<encodedCwd>/<sessionUUID>.jsonl`
- `encodeCwd`:`\` `/` `:` 全替换为 `-`(与 Claude Code 一致,跨平台稳定)
- 每条消息 `JSON.stringify(msg) + "\n"` append。**没有删除/改写操作**
- 启动选项:
  - 默认 → `SessionStore.create()` 全新会话
  - `-c` → `SessionStore.loadLatest()` 按 mtime 取最新
  - `/load <prefix>` → 按 uuid 前缀匹配,冲突即报错

只有用户/助手/工具消息流回放,system 消息靠运行时重新注入(`/new` `/clear` 会重写 system message,见 `commands.ts`)。

## 流式渲染(src/render.ts)

`createStreamRenderer()` 返回 `{ write, finish, reset }`:
- 内部用 md4x 增量渲染 Markdown 到 ANSI
- 节流 60ms 重绘一次(`REDRAW_INTERVAL_MS`)
- 全角字符宽度判定见 `isWide`,中文/CJK 占 2 列

`renderHistory(history)` 在 `-c` 续接或 `/load` 后用,把已存的 assistant 消息一次性重渲染出来。

## 补全器(src/completer.ts)

**必须是同步函数(arity=1)**。Node 24 `readline/promises` 的异步回调路径(arity=2)在 `_tabCompleter` 处解构 undefined 会崩。

`buildCompleter()` 返回:

```ts
(line: string) => [string[], string]
```

逻辑:取行末空白前的"当前词",
- `/xxx`(且词内不含 `/`)→ `allCommands()` 名前缀过滤
- `@path` → `readdirSync` 同步列目录;`safePath()` 防越界
- 否则空补全

`expandAtRefs(input)`(异步 OK,因为在提交时调,不卡补全):
- 正则 `/(?:^|\s)@([^\s]+)/g` 抓所有引用
- 去重后逐个 `fsRead(safePath(ref))`
- 失败降级为 `[跳过]` 警告,不中断
- 把每个文件包成 `--- 附件: path ---\n<content>\n--- 结束 ---` 拼到 user message 前面

## 共享 shell 执行(src/shellExec.ts)

`runShell(command, timeoutMs?)` 返回 `{ stdout, stderr, error? }`。

- `detectShell()` 在模块加载时跑一次(同步 `execSync` 探测),Windows 上按 pwsh → powershell → cmd 顺序选第一个能跑通的;其他平台返回 undefined 让 exec 走默认 `/bin/sh`
- 导出 `CURRENT_SHELL` 字符串和 `shellSyntaxHint()` 提示信息(嵌入 `execute_shell` 工具的 description,让 LLM 知道当前是哪种 shell 语法)
- 被 `src/index.ts` 的 `!` 前缀直用,也被 `src/tools/shell.ts` 工具包装(后者多一层 `confirm()` 确认)

## 代理 / 抓包(src/proxy.ts)

`import "./proxy.js"` 必须是 `src/index.ts` 的**第一条 import**。

代码内容仅一行 if:存在 `HTTPS_PROXY` / `HTTP_PROXY` 时挂 undici 的 `EnvHttpProxyAgent`,自动遵循 `NO_PROXY`。不设环境变量则零开销。

Node 的根 CA 需要靠 `NODE_EXTRA_CA_CERTS` 注入(在 TLS 初始化前由 Node 读取,**不能写在 .env 里**,dotenv 还没加载就晚了)。
