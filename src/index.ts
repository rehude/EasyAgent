import readline from "node:readline/promises";
import pc from "picocolors";
import { chat } from "./llm.js";
import { SYSTEM_PROMPT } from "./prompts.js";
import type OpenAI from "openai";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const history: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: SYSTEM_PROMPT },
];

console.log(pc.cyan("easyAgent v0.1 — 输入 exit 或 Ctrl+C 退出"));
while (true) {
  const input = (await rl.question(pc.green("> "))).trim();
  if (!input) continue;
  if (input === "exit") break;
  history.push({ role: "user", content: input });
  const reply = await chat(history);
  history.push(reply);
  console.log(pc.gray(reply.content ?? ""));
}
rl.close();
