import type { UiAdapter } from "./types.js";

let current: UiAdapter | null = null;

export function setCurrentUi(ui: UiAdapter): void {
  current = ui;
}

export function getCurrentUi(): UiAdapter {
  if (!current) throw new Error("UI 尚未初始化(setCurrentUi 未调用)");
  return current;
}
