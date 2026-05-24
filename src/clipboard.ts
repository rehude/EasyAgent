import { spawn } from "node:child_process";
import { platform } from "node:os";

interface ClipCmd {
  cmd: string;
  args: string[];
}

function candidates(): ClipCmd[] {
  switch (platform()) {
    case "win32":
      return [{ cmd: "clip", args: [] }];
    case "darwin":
      return [{ cmd: "pbcopy", args: [] }];
    default:
      return [
        { cmd: "wl-copy", args: [] },
        { cmd: "xclip", args: ["-selection", "clipboard"] },
        { cmd: "xsel", args: ["--clipboard", "--input"] },
      ];
  }
}

function tryOne(text: string, { cmd, args }: ClipCmd): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    child.on("error", reject);
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} 退出码 ${code}${stderr ? ": " + stderr.trim() : ""}`));
    });
    child.stdin.end(text, "utf8");
  });
}

export async function copyToClipboard(text: string): Promise<void> {
  const cmds = candidates();
  let lastErr: unknown;
  for (const c of cmds) {
    try {
      await tryOne(text, c);
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("没有可用的剪贴板工具(尝试了 " + cmds.map((c) => c.cmd).join(", ") + ")");
}
