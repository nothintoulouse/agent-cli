import type { AgentAdapter, RunOpts, ParsedResult } from './types.js';

export class CodexAdapter implements AgentAdapter {
  name = 'codex';
  aliases = ['x'];
  command = 'codex';

  buildArgs(opts: RunOpts): string[] {
    const args: string[] = [];

    if (opts.sessionId) {
      args.push('exec', 'resume', opts.sessionId, opts.message);
    } else {
      args.push('exec', opts.message);
    }

    args.push('--full-auto', '--json');
    args.push('-C', opts.cwd);

    if (opts.model) {
      args.push('-m', opts.model);
    }

    if (opts.additionalDirs) {
      for (const dir of opts.additionalDirs) {
        args.push('--add-dir', dir);
      }
    }

    return args;
  }

  parseResult(output: string): ParsedResult {
    const lines = output.trim().split('\n');
    let text = '';
    let sessionId = '';
    let isError = false;

    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        // Legacy format
        if (event.type === 'message' && event.role === 'assistant' && event.content) {
          text = event.content;
        }
        // Current format: item.completed with nested item.text
        if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item?.text) {
          text = event.item.text;
        }
        if (event.session_id) {
          sessionId = event.session_id;
        }
        if (event.thread_id) {
          sessionId = event.thread_id;
        }
        if (event.type === 'error') {
          isError = true;
          text = event.message || event.error?.message || event.content || text;
        }
      } catch {
        // skip non-JSON lines
      }
    }

    return { text, sessionId, isError };
  }
}
