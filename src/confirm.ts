import readline from "node:readline/promises";
import pc from "picocolors";

export async function confirm(msg: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ans = (await rl.question(pc.yellow(`${msg} (y/N) `))).trim().toLowerCase();
  rl.close();
  return ans === "y" || ans === "yes";
}
