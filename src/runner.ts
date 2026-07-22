import { spawn } from 'node:child_process';
import { execSync } from 'node:child_process';
import type { AgentAdapter, RunOpts, ParsedResult } from './adapters/types.js';

export interface RunResult {
  parsed: ParsedResult;
  rawOutput: string;
  exitCode: number | null;
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const INSTALL_HINTS: Record<string, string> = {
  claude: 'See https://docs.anthropic.com/en/docs/claude-code/overview',
  codex: 'npm i -g @openai/codex',
  gemini: 'npm i -g @google/gemini-cli',
};

export async function runAgent(adapter: AgentAdapter, opts: RunOpts): Promise<RunResult> {
  if (!commandExists(adapter.command)) {
    const hint = INSTALL_HINTS[adapter.name] ?? '';
    const msg = `Error: ${adapter.command} not found.${hint ? ` Install it with: ${hint}` : ''}`;
    return {
      parsed: { text: msg, sessionId: '', isError: true },
      rawOutput: '',
      exitCode: 1,
    };
  }

  const args = adapter.buildArgs(opts);

  return new Promise((resolve) => {
    const child = spawn(adapter.command, args, {
      cwd: opts.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (opts.verbose) {
        process.stdout.write(text);
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        resolve({
          parsed: { text: stderr.trim() || `Process exited with code ${code}`, sessionId: '', isError: true },
          rawOutput: stderr,
          exitCode: code,
        });
        return;
      }

      try {
        const parsed = adapter.parseResult(stdout);
        resolve({ parsed, rawOutput: stdout, exitCode: code });
      } catch (err) {
        resolve({
          parsed: { text: stdout.trim() || stderr.trim(), sessionId: '', isError: true },
          rawOutput: stdout,
          exitCode: code,
        });
      }
    });

    child.on('error', (err) => {
      resolve({
        parsed: { text: `Failed to spawn ${adapter.command}: ${err.message}`, sessionId: '', isError: true },
        rawOutput: '',
        exitCode: 1,
      });
    });
  });
}
