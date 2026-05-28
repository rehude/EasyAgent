import React from "react";
import { Box, Text } from "ink";
import { renderToAnsi } from "md4x";
import type OpenAI from "openai";

export interface MessageBlock {
  id: string;
  role: "user" | "assistant" | "tool" | "info" | "warning" | "error" | "shell";
  text: string;
  toolName?: string;
}

let blockCounter = 0;
export const newBlockId = (): string => `b${++blockCounter}`;

export function messagesToBlocks(
  messages: OpenAI.ChatCompletionMessageParam[],
): MessageBlock[] {
  const out: MessageBlock[] = [];
  const callNames = new Map<string, string>();
  for (const m of messages) {
    if (m.role === "assistant" && (m as any).tool_calls) {
      for (const c of (m as any).tool_calls) {
        if (c?.type === "function" && c?.id)
          callNames.set(c.id, c.function?.name ?? "?");
      }
    }
  }
  for (const m of messages) {
    if (m.role === "system") continue;
    const text = typeof m.content === "string" ? m.content : "";
    if (m.role === "user") {
      if (text) out.push({ id: newBlockId(), role: "user", text });
    } else if (m.role === "assistant") {
      if (text) out.push({ id: newBlockId(), role: "assistant", text });
      const calls = (m as any).tool_calls as
        | OpenAI.ChatCompletionMessageToolCall[]
        | undefined;
      if (calls) {
        for (const c of calls) {
          if (c.type === "function") {
            out.push({
              id: newBlockId(),
              role: "tool",
              toolName: c.function.name,
              text: `⚙ ${c.function.name}(${c.function.arguments})`,
            });
          }
        }
      }
    } else if (m.role === "tool") {
      const id = (m as any).tool_call_id as string | undefined;
      const name = id ? callNames.get(id) ?? "tool" : "tool";
      out.push({ id: newBlockId(), role: "tool", toolName: name, text });
    }
  }
  return out;
}

export function MessageBlockView({ b }: { b: MessageBlock }): React.ReactElement {
  if (b.role === "user") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="green">{"> "}{b.text}</Text>
      </Box>
    );
  }
  if (b.role === "assistant") {
    return (
      <Box flexDirection="column" marginTop={1}>
        <Text color="cyan">[回答]</Text>
        <Text>{renderToAnsi(b.text)}</Text>
      </Box>
    );
  }
  if (b.role === "tool") {
    return (
      <Box marginTop={1}>
        <Text color="yellow">{b.text}</Text>
      </Box>
    );
  }
  if (b.role === "info") {
    return (
      <Box>
        <Text color="cyan">{b.text}</Text>
      </Box>
    );
  }
  if (b.role === "warning") {
    return (
      <Box>
        <Text color="yellow">{b.text}</Text>
      </Box>
    );
  }
  if (b.role === "error") {
    return (
      <Box>
        <Text color="red">{b.text}</Text>
      </Box>
    );
  }
  // shell
  return (
    <Box flexDirection="column" marginTop={1}>
      <Text color="yellow">{b.text}</Text>
    </Box>
  );
}
