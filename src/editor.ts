import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

interface EditorChoice {
  cmd: string;
  args: string[];
}

function pickEditor(): EditorChoice {
  const env = process.env.VISUAL || process.env.EDITOR;
  if (env && env.trim()) {
    // 支持 "code -w" 这种带参数的 EDITOR 设置
    const parts = env.trim().split(/\s+/);
    return { cmd: parts[0], args: parts.slice(1) };
  }
  return process.platform === "win32"
    ? { cmd: "notepad", args: [] }
    : { cmd: "vi", args: [] };
}

/**
 * 在 $EDITOR 中打开一个临时文件,等用户保存退出后读回内容。
 * - 返回 trim 后的内容;空内容返回 null(视为取消)
 * - 编辑器异常退出会抛出 Error
 * - 临时文件与目录在 finally 中清理
 */
export async function editInExternal(initial = ""): Promise<string | null> {
  const dir = mkdtempSync(join(tmpdir(), "rehudex-edit-"));
  const file = join(dir, "input.md");
  writeFileSync(file, initial, "utf8");

  const { cmd, args } = pickEditor();
  try {
    await new Promise<void>((resolve, reject) => {
      const c = spawn(cmd, [...args, file], { stdio: "inherit" });
      c.on("error", reject);
      c.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`${cmd} 退出码 ${code}`)),
      );
    });
    const content = readFileSync(file, "utf8").trim();
    return content || null;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      // 文件可能已被编辑器移走/重命名,忽略
    }
    try {
      rmdirSync(dir);
    } catch {
      // 同上
    }
  }
}
