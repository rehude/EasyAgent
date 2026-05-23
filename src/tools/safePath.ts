import path from "node:path";

export function safePath(input: string): string {
  const cwd = path.resolve(process.cwd());
  const abs = path.resolve(cwd, input);
  if (abs !== cwd && !abs.startsWith(cwd + path.sep)) {
    throw new Error(`路径越界: ${input} 不在工作目录 ${cwd} 之下`);
  }
  return abs;
}
