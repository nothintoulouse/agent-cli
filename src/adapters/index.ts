import type { AgentAdapter } from './types.js';
import { ClaudeAdapter } from './claude.js';
import { CodexAdapter } from './codex.js';
import { GeminiAdapter } from './gemini.js';

const adapters: AgentAdapter[] = [
  new ClaudeAdapter(),
  new CodexAdapter(),
  new GeminiAdapter(),
];

export function getAdapter(nameOrAlias: string): AgentAdapter | undefined {
  return adapters.find(a => a.name === nameOrAlias || a.aliases.includes(nameOrAlias));
}

export function getAllAdapters(): AgentAdapter[] {
  return adapters;
}

export { type AgentAdapter, type RunOpts, type ParsedResult } from './types.js';
