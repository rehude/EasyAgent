import { getCurrentUi } from "../ui/current.js";
import type { Tool } from "../types.js";

export const askUser: Tool = {
  name: "ask_user",
  description:
    "向用户提问以澄清意图或让其在选项中选择。当任务存在歧义、需要决策或缺少关键信息时调用。" +
    "若提供 options,用户输入数字编号即可选中;输入其他文本则按自由回答处理。",
  readOnly: true,
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "向用户展示的问题" },
      options: {
        type: "array",
        items: { type: "string" },
        description: "可选项列表;省略或为空则要求用户自由输入文本",
      },
    },
    required: ["question"],
  },
  async execute({ question, options }: { question: string; options?: string[] }) {
    if (!process.stdin.isTTY) {
      return "错误:非交互终端,无法向用户提问";
    }
    const ui = getCurrentUi();
    const opts = Array.isArray(options) ? options.filter((o) => typeof o === "string" && o.length) : [];

    ui.emit({ type: "info", data: `[ask_user] ${question}` });
    if (opts.length) {
      const lines = opts.map((o, i) => `  ${i + 1}) ${o}`);
      lines.push(`  0) 自由输入`);
      ui.emit({ type: "info", data: lines.join("\n") });
    }

    const answer = (await ui.readInput(() => "ask_user> ")).trim();
    if (!answer) return "用户未提供回答";

    if (opts.length) {
      const n = Number(answer);
      if (Number.isInteger(n) && n >= 1 && n <= opts.length) {
        return opts[n - 1];
      }
      if (n === 0) {
        const free = (await ui.readInput(() => "自由输入> ")).trim();
        return free || "用户未提供回答";
      }
    }
    return answer;
  },
};
