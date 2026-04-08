import type { ParsedResult } from './adapters/types.js';

export function formatDefault(result: ParsedResult, agentName: string): string {
  const lines: string[] = [];

  const icon = result.isError ? '✗' : '✓';
  lines.push(`${icon} ${result.text.trim()}`);

  const meta: string[] = [];
  if (result.duration) {
    const secs = Math.round(result.duration / 1000);
    meta.push(`${secs}s`);
  }
  if (result.cost !== undefined && result.cost > 0) {
    meta.push(`$${result.cost.toFixed(2)}`);
  }

  if (meta.length > 0) {
    lines.push(`  ${agentName} · ${meta.join(' · ')}`);
  }

  return lines.join('\n');
}
