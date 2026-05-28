import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

export type SkillSource = "user" | "project" | "claude";

export interface SkillInfo {
  name: string;
  description: string;
  body: string;
  dir: string;
  scripts: string[];
  allowedTools?: string[];
  source: SkillSource;
}

const cache = new Map<string, SkillInfo>();
let loaded = false;

function skillRoots(): { dir: string; source: SkillSource }[] {
  return [
    { dir: path.join(homedir(), ".rehudex", "skills"), source: "user" },
    { dir: path.join(process.cwd(), ".rehudex", "skills"), source: "project" },
    { dir: path.join(process.cwd(), ".claude", "skills"), source: "claude" },
  ];
}

function listScripts(skillDir: string): string[] {
  const dir = path.join(skillDir, "scripts");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => path.join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

interface Frontmatter {
  fields: Record<string, string | string[]>;
  body: string;
}

function parseFrontmatter(text: string): Frontmatter {
  const t = text.replace(/^﻿/, "");
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(t);
  if (!m) return { fields: {}, body: t };
  const head = m[1];
  const body = m[2] ?? "";
  const fields: Record<string, string | string[]> = {};

  const lines = head.split(/\r?\n/);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const km = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (!km) {
      i++;
      continue;
    }
    const key = km[1];
    const rest = km[2].trim();
    if (rest === "" || rest === "|" || rest === ">") {
      const items: string[] = [];
      i++;
      while (i < lines.length) {
        const l = lines[i];
        const im = /^\s*-\s+(.*)$/.exec(l);
        if (!im) break;
        items.push(stripQuotes(im[1].trim()));
        i++;
      }
      fields[key] = items;
      continue;
    }
    if (rest.startsWith("[") && rest.endsWith("]")) {
      const inner = rest.slice(1, -1);
      const items = inner
        .split(",")
        .map((s) => stripQuotes(s.trim()))
        .filter((s) => s.length);
      fields[key] = items;
    } else {
      fields[key] = stripQuotes(rest);
    }
    i++;
  }
  return { fields, body };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function tryLoadSkill(skillDir: string, source: SkillSource, fallbackName: string): SkillInfo | null {
  const skillMd = path.join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) return null;
  let raw: string;
  try {
    raw = readFileSync(skillMd, "utf8");
  } catch {
    return null;
  }
  const { fields, body } = parseFrontmatter(raw);
  const name =
    typeof fields.name === "string" && fields.name.trim() ? fields.name.trim() : fallbackName;
  const description =
    typeof fields.description === "string" ? fields.description.trim() : "";
  const allowedTools = Array.isArray(fields["allowed-tools"])
    ? (fields["allowed-tools"] as string[])
    : undefined;
  return {
    name,
    description,
    body: body.trim(),
    dir: skillDir,
    scripts: listScripts(skillDir),
    allowedTools,
    source,
  };
}

export function loadSkills(): Map<string, SkillInfo> {
  cache.clear();
  for (const { dir, source } of skillRoots()) {
    if (!existsSync(dir)) continue;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const skillDir = path.join(dir, e.name);
      const sk = tryLoadSkill(skillDir, source, e.name);
      if (sk) cache.set(sk.name, sk);
    }
  }
  loaded = true;
  return cache;
}

function ensureLoaded(): void {
  if (!loaded) loadSkills();
}

export function listSkills(): SkillInfo[] {
  ensureLoaded();
  return [...cache.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getSkill(name: string): SkillInfo | undefined {
  ensureLoaded();
  return cache.get(name);
}
