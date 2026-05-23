import { exec } from "node:child_process";
import { promisify } from "node:util";
import { confirm } from "../confirm.js";
import type { Tool } from "../types.js";

const pexec = promisify(exec);

export const shell: Tool = {
  name: "execute_shell",
  description: "在 cwd 下执行 shell 命令并返回 stdout/stderr。涉及副作用,需用户确认",
  parameters: {
    type: "object",
    properties: { command: { type: "string" } },
    required: ["command"],
  },
  async execute({ command }) {
    const ok = await confirm(`执行命令: ${command}?`);
    if (!ok) return "用户取消了命令";
    try {
      const { stdout, stderr } = await pexec(command, { cwd: process.cwd(), timeout: 30_000 });
      return `stdout:\n${stdout}\nstderr:\n${stderr}`;
    } catch (e: any) {
      return `命令失败: ${e.message}\nstdout:\n${e.stdout ?? ""}\nstderr:\n${e.stderr ?? ""}`;
    }
  },
};
