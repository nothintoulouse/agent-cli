import { parseArgs } from './parse-args.js';
import { loadConfig, setConfigValue, getConfigDir } from './config.js';
import { SessionManager } from './session.js';
import { getAdapter } from './adapters/index.js';
import { runAgent } from './runner.js';
import { formatDefault } from './formatter.js';
import { snapshotBeforeRun, performUndo } from './undo.js';
import path from 'node:path';

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function showHelp(): void {
  console.log(`Usage: agent [agent-name] <message>
       a [agent-name] <message>

Agents: claude (c), codex (x), gemini (g)

Flags:
  -m, --model <model>    Override model
  -e, --effort <level>   Effort: low, medium, high, max (Claude only)
  -v, --verbose          Stream full output
  -n, --name <name>      Name this session
  -r, --resume <name>    Resume a named session
  --new                  Start fresh session
  --bg                   Run in background
  --json                 Raw JSON output
  --add-dir <path>       Additional directory access
  --budget <usd>         Max spend (Claude only)

Commands:
  agent ls               List sessions
  agent log              Show last turn output
  agent diff             Show git diff of changes
  agent undo             Revert last agent changes
  agent bg               Check background task
  agent config           Show config
  agent config set <k> <v>  Set config value
  agent config path      Print config path
  agent help             This help text`);
}

async function handleConfig(args: string[]): Promise<void> {
  if (!args || args.length === 0) {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (args[0] === 'path') {
    console.log(path.join(getConfigDir(), 'config.json'));
    return;
  }
  if (args[0] === 'set' && args.length >= 3) {
    setConfigValue(args[1], args[2]);
    console.log(`Set ${args[1]} = ${args[2]}`);
    return;
  }
  console.error('Usage: agent config [set <key> <value> | path]');
}

async function handleLs(): Promise<void> {
  const sm = new SessionManager(path.join(getConfigDir(), 'sessions.json'));
  const sessions = sm.listAll();

  if (sessions.length === 0) {
    console.log('No sessions found.');
    return;
  }

  console.log('  AGENT      SESSION ID               DIR                          LAST USED');
  for (const s of sessions) {
    const dirBase = path.basename(s.dir);
    const ago = timeSince(s.lastUsed);
    const id = s.id.substring(0, 20) + '...';
    console.log(`  ${s.agent.padEnd(10)} ${id.padEnd(24)} ${dirBase.padEnd(28)} ${ago}`);
  }
}

function timeSince(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const parsed = parseArgs(process.argv.slice(2), config.defaultAgent);

  // Handle subcommands
  if (parsed.subcommand) {
    switch (parsed.subcommand) {
      case 'help': showHelp(); return;
      case 'config': await handleConfig(parsed.subcommandArgs ?? []); return;
      case 'ls': await handleLs(); return;
      case 'diff':
        try { const { execSync } = await import('node:child_process'); execSync('git diff', { stdio: 'inherit' }); } catch { /* no-op */ }
        return;
      case 'undo': performUndo(); return;
      case 'log':
        console.log('log: not yet implemented');
        return;
      case 'bg':
        console.log('bg: not yet implemented');
        return;
    }
    return;
  }

  // Read stdin if piped
  const stdinContent = await readStdin();
  let message = parsed.message;
  if (stdinContent) {
    message = message ? `${message}\n\n---\n${stdinContent}` : stdinContent;
  }

  if (!message) {
    showHelp();
    return;
  }

  // Resolve adapter
  const adapter = getAdapter(parsed.agent);
  if (!adapter) {
    console.error(`Unknown agent: ${parsed.agent}`);
    process.exit(1);
  }

  // Resolve session
  const sm = new SessionManager(path.join(getConfigDir(), 'sessions.json'));
  const cwd = process.cwd();
  let sessionKey = adapter.name;
  if (parsed.resumeName) {
    sessionKey = `${adapter.name}:${parsed.resumeName}`;
  } else if (parsed.sessionName) {
    sessionKey = `${adapter.name}:${parsed.sessionName}`;
  }

  let sessionId: string | undefined;
  if (!parsed.newSession) {
    sessionId = sm.get(cwd, sessionKey)?.id;
  }

  // Resolve model from flag or config
  const agentConfig = config.agents[adapter.name as keyof typeof config.agents];
  const model = parsed.model ?? agentConfig?.model;
  const effort = parsed.effort ?? agentConfig?.effort;

  // Snapshot git state for undo support
  snapshotBeforeRun(cwd, adapter.name);

  // Run
  const result = await runAgent(adapter, {
    message,
    sessionId,
    model,
    effort,
    verbose: parsed.verbose,
    outputJson: parsed.outputJson,
    additionalDirs: parsed.additionalDirs,
    budget: parsed.budget,
    cwd,
  });

  // Update session
  if (result.parsed.sessionId) {
    sm.set(cwd, sessionKey, result.parsed.sessionId);
  }

  // Output
  if (parsed.outputJson) {
    console.log(result.rawOutput);
  } else if (!parsed.verbose) {
    console.log(formatDefault(result.parsed, adapter.name));
  }
  // verbose mode already streamed output during run

  if (result.parsed.isError) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
