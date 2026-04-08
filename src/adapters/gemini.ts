import type { AgentAdapter, RunOpts, ParsedResult } from './types.js';

export class GeminiAdapter implements AgentAdapter {
  name = 'gemini';
  aliases = ['g'];
  command = 'gemini';

  buildArgs(opts: RunOpts): string[] {
    const args: string[] = [opts.message];

    if (opts.verbose) {
      args.push('--output-format', 'stream-json');
    } else {
      args.push('--output-format', 'json');
    }

    args.push('--approval-mode', 'yolo');

    if (opts.sessionId) {
      args.push('--resume', opts.sessionId);
    }

    if (opts.model) {
      args.push('-m', opts.model);
    }

    if (opts.additionalDirs) {
      for (const dir of opts.additionalDirs) {
        args.push('--include-directories', dir);
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
