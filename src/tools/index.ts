import type { Tool } from "../types.js";
import type OpenAI from "openai";

const registry = new Map<string, Tool>();

export function registerTool(t: Tool) {
  registry.set(t.name, t);
}

export function getTool(name: string): Tool | undefined {
  return registry.get(name);
}

export function toOpenAITools(): OpenAI.ChatCompletionTool[] {
  return [...registry.values()].map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
