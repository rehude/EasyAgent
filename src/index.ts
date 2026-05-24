#!/usr/bin/env node
import "./proxy.js";
import pc from "picocolors";
import { agentRun } from "./agent.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import { registerTool } from "./tools/index.js";
import { readFile } from "./tools/readFile.js";
import { writeFile } from "./tools/writeFile.js";
import { shell } from "./tools/shell.js";
import { getRL, closeRL } from "./cli.js";
import readline from "node:readline/promises";
import { SessionStore } from "./session.js";
import { renderHistory } from "./render.js";
import { getCommand, type CommandContext } from "./commands.js";
import { buildCompleter, expandAtRefs } from "./completer.js";
import { runShell, CURRENT_SHELL } from "./shellExec.js";
import type OpenAI from "openai";

registerTool(readFile);
registerTool(writeFile);
registerTool(shell);

const rl = getRL(buildCompleter());

const continueLast = process.argv.slice(2).includes("-c");
const systemMsg: OpenAI.ChatCompletionMessageParam = {
  role: "system",
  content: SYSTEM_PROMPT,
};

let store: SessionStore;
let history: OpenAI.ChatCompletionMessageParam[];

if (continueLast) {
  const latest = SessionStore.loadLatest();
  if (latest) {
    store = latest.store;
    history = latest.messages;
    console.log(
      pc.cyan(`续接会话 ${store.id.slice(0, 8)} (${history.length} 条消息)`),
    );
    renderHistory(history);
  } else {
    console.log(pc.yellow("本项目无历史会话,创建新会话"));
    store = SessionStore.create();
    history = [systemMsg];
    store.append(systemMsg);
  }
} else {
  store = SessionStore.create();
  history = [systemMsg];
  store.append(systemMsg);
}
console.log(pc.dim(`session: ${store.file}`));

const sessionUsage = { prompt: 0, completion: 0, total: 0 };
let closed = false;

const shutdown = (code = 0) => {
  if (closed) return;
  closed = true;
  if (sessionUsage.total > 0) {
    console.log(
      pc.dim(
        `\n本次会话累计 token:prompt=${sessionUsage.prompt} completion=${sessionUsage.completion} total=${sessionUsage.total}`,
      ),
    );
  }
  console.log(pc.cyan("再见 👋"));
  closeRL();
  process.exit(code);
};

rl.on("SIGINT", () => shutdown(0));
rl.on("close", () => {
  if (!closed) shutdown(0);
});

console.log(pc.cyan("rehudex v0.2 — 输入 exit 或按 Ctrl+C 退出"));
console.log(
  pc.dim("提示: / 命令(Tab 补全) | @文件 引用 | !cmd 直接 shell | 行尾 \\ 续行 | /edit 长输入 | /help 查看全部"),
);

const cmdCtx: CommandContext = {
  history,
  store,
  systemMsg,
  setStore(s) {
    store = s;
    cmdCtx.store = s;
  },
};

/**
 * 多行输入读取:行尾以 `\` 结尾就续行(去掉 `\`),否则把累积内容用 `\n` 连接后返回。
 * 续行 prompt 与首行一致(用户偏好保持 `> `)。
 */
async function readUserInput(r: readline.Interface): Promise<string> {
  const parts: string[] = [];
  while (true) {
    const line = await r.question(pc.green("> "));
    if (line.endsWith("\\")) {
      parts.push(line.slice(0, -1));
      continue;
    }
    parts.push(line);
    return parts.join("\n");
  }
}

/**
 * 把一段文本当成本轮 user 输入:走 @ 展开 + agentRun + sessionUsage 累加。
 * 同时被普通输入路径和 SlashCommand 返回 string 的路径(如 /edit)共用。
 */
async function processMessage(text: string): Promise<void> {
  const expanded = await expandAtRefs(text);
  const { usage } = await agentRun(expanded, history, store);
  if (usage.total > 0) {
    sessionUsage.prompt += usage.prompt;
    sessionUsage.completion += usage.completion;
    sessionUsage.total += usage.total;
    console.log(
      pc.dim(`(本轮 ${usage.total} / 累计 ${sessionUsage.total} tokens)`),
    );
  }
}

while (!closed) {
  let input: string;
  try {
    input = (await readUserInput(rl)).trim();
  } catch {
    break;
  }
  if (closed) break;
  if (!input) continue;
  if (input === "exit") {
    shutdown(0);
    break;
  }

  // ! 前缀:直接执行 shell,结果入 history
  if (input.startsWith("!")) {
    const cmd = input.slice(1).trim();
    if (!cmd) continue;
    console.log(pc.yellow(`⚙ ${CURRENT_SHELL} $ ${cmd}`));
    const { stdout, stderr, error } = await runShell(cmd);
    if (stdout) process.stdout.write(stdout.endsWith("\n") ? stdout : stdout + "\n");
    if (stderr) process.stderr.write(pc.red(stderr.endsWith("\n") ? stderr : stderr + "\n"));
    if (error) console.log(pc.red(`命令异常: ${error}`));
    const summary =
      `[用户在 shell 执行] ${cmd}\nstdout:\n${stdout}\nstderr:\n${stderr}` +
      (error ? `\nerror:\n${error}` : "");
    const msg: OpenAI.ChatCompletionMessageParam = { role: "user", content: summary };
    history.push(msg);
    store.append(msg);
    continue;
  }

  // / 前缀:走命令注册表
  if (input.startsWith("/")) {
    const [name, ...rest] = input.slice(1).split(/\s+/);
    const cmd = getCommand(name);
    if (!cmd) {
      console.log(pc.red(`未知命令: /${name}`), pc.dim("输入 /help 查看可用命令"));
      continue;
    }
    const result = await cmd.run(rest.join(" "), cmdCtx);
    // 命令返回非空字符串 → 作为本轮 user 输入继续走 agentRun(用于 /edit 等)
    if (typeof result === "string" && result.trim()) {
      await processMessage(result);
    }
    continue;
  }

  // 其余:@ 文件引用展开后丢给 LLM
  await processMessage(input);
}
