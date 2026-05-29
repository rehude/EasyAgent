import type { UiAdapter } from "./types.js";
import { ClassicAdapter } from "./classic.js";

export type UiType = "classic" | "ink";

export async function createUiAdapter(type: UiType = "ink"): Promise<UiAdapter> {
  switch (type) {
    case "classic":
      return new ClassicAdapter();
    case "ink": {
      // 非 TTY 下 Ink 会失败,提前回退
      if (!process.stdout.isTTY || !process.stdin.isTTY) {
        return new ClassicAdapter();
      }
      try {
        const mod = await import("./ink/InkAdapter.js");
        return new mod.InkAdapter();
      } catch (err: any) {
        const pc = (await import("picocolors")).default;
        console.warn(pc.yellow(`⚠ Ink UI 加载失败,回退 classic: ${err?.message ?? err}`));
        return new ClassicAdapter();
      }
    }
    default:
      throw new Error(`Unknown UI type: ${type}`);
  }
}

export { ClassicAdapter };
export type { UiAdapter, UiEvent, UiEventType } from "./types.js";
