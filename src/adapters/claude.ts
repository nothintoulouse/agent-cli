import type { AgentAdapter, RunOpts, ParsedResult } from './types.js';

export class ClaudeAdapter implements AgentAdapter {
  name = 'claude';
  aliases = ['c'];
  command = 'claude';

  buildArgs(opts: RunOpts): string[] {
    const args: string[] = ['-p', opts.message];

    if (opts.verbose) {
      args.push('--output-format', 'stream-json', '--verbose');
    } else {
      args.push('--output-format', 'json');
    }

    args.push('--dangerously-skip-permissions');

    if (opts.sessionId) {
      args.push('--resume', opts.sessionId);
    }

    if (opts.model) {
      args.push('--model', opts.model);
    }

    if (opts.effort) {
      args.push('--effort', opts.effort);
    }

    if (opts.budget !== undefined) {
      args.push('--max-budget-usd', String(opts.budget));
    }

    if (opts.additionalDirs) {
      for (const dir of opts.additionalDirs) {
        args.push('--add-dir', dir);
      }
    }

    return args;
  }

  parseResult(output: string): ParsedResult {
    const data = JSON.parse(output);
    return {
      text: data.result ?? '',
      sessionId: data.session_id ?? '',
      cost: data.total_cost_usd,
      duration: data.duration_ms,
      isError: Boolean(data.is_error),
    };
  }
}
