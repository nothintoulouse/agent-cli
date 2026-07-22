# agent-cli Design Spec

A thin CLI wrapper that provides a unified interface for Claude Code, Codex, and Gemini CLI agents. Abstracts away per-agent flag differences, manages persistent sessions automatically, and formats output cleanly.

## Problem

Three AI coding CLIs (Claude Code, Codex, Gemini) each have different flag syntax for the same concepts (model selection, auto-approve, session resume, output format). Remembering the right invocation per agent, tracking session IDs manually, and typing long flag strings — especially on mobile SSH clients — creates friction that undermines daily use.

## Solution

A single command (`agent` / `a`) that:
- Builds the correct CLI command for any supported agent
- Manages sessions automatically by directory + agent name
- Parses structured JSON output and displays it cleanly
- Exposes a small set of unified flags that map to each agent's native flags

## Architecture

```
agent CLI (TypeScript, Node.js)
├── Argument Parser     — parse command, flags, message, stdin
├── Session Manager     — track session IDs per directory+agent
├── Agent Adapters      — build the right CLI command per agent
└── Output Formatter    — parse JSON responses, display nicely
```

The wrapper spawns each agent's CLI as a child process using its non-interactive/pipe mode. It does not use terminal emulation, tmux, or PTY management. Each CLI writes session state to its own disk storage; the wrapper only tracks the session ID mapping.

## Command Interface

### Primary usage

```
agent [agent-name] <message>        Send a message to an agent
a [agent-name] <message>            Shorthand (same binary)
```

### Agent names and aliases

| Agent | Aliases |
|-------|---------|
| claude | c |
| codex | x |
| gemini | g |

Default agent: `claude` (configurable).

### Argument parsing

The first positional arg is checked against known agent names/aliases and subcommands. If it matches, it's consumed. Everything remaining joins as the message string.

```bash
agent fix the failing tests              # claude, message = "fix the failing tests"
agent codex refactor the auth module     # codex, message = "refactor the auth module"
agent ls                                 # subcommand, no message
```

Quotes are only needed if the message starts with an agent name or subcommand keyword.

### Flags

```
Core:
  -m, --model <model>      Override model for this message
  -e, --effort <level>     Thinking effort: low, medium, high, max (Claude only)
  -v, --verbose            Stream full output (diffs, commands, thinking)
  --new                    Start a fresh session, don't auto-resume
  --bg                     Run in background, notify when done
  --json                   Raw JSON output (for scripting and downstream integration)

Session:
  -n, --name <name>        Name this session explicitly
  -r, --resume <name>      Resume a specific named session

Advanced:
  --add-dir <path>         Additional directory access
  --budget <usd>           Max spend for this call (Claude only)
```

### Subcommands

```
agent ls                   List sessions (all agents, sorted by recency)
agent log                  Show last turn's full output for current session
agent diff                 Show git diff of agent's changes
agent undo                 Revert agent's last changes
agent bg                   Check background task status / show last bg output
agent config               Show config
agent config set <k> <v>   Set a config value
agent config path          Print config file path
agent help                 Help text
```

### Stdin piping

If stdin is not a TTY (piped input detected), read it and append to the message with a separator:

```bash
git diff | agent "review this diff"
cat error.log | agent "why is this crashing"
npm test 2>&1 | agent "fix these test failures"
```

The combined prompt sent to the agent: `{message}\n\n---\n{stdin content}`

## Agent Adapters

Each adapter is a module that knows how to build CLI arguments and parse output for one agent.

### Interface

```typescript
interface AgentAdapter {
  name: string;
  aliases: string[];
  command: string;
  buildArgs(opts: RunOpts): string[];
  parseResult(output: string): ParsedResult;
  getSessionIdFromResult(output: string): string | null;
}

interface RunOpts {
  message: string;
  sessionId?: string;
  model?: string;
  effort?: string;
  verbose: boolean;
  outputJson: boolean;
  additionalDirs?: string[];
  budget?: number;
  cwd: string;
}

interface ParsedResult {
  text: string;
  sessionId: string;
  cost?: number;
  duration?: number;
  isError: boolean;
}
```

### Claude Code adapter

Non-interactive mode: `-p` flag.

```
claude -p <message>
  --output-format json              (default mode)
  --output-format stream-json       (verbose mode)
  --verbose                         (required with stream-json)
  --dangerously-skip-permissions
  --resume <sessionId>              (if resuming)
  --session-id <uuid>               (if new named session)
  --model <model>                   (if overridden)
  --effort <level>                  (if specified)
  --add-dir <path>                  (if specified)
  --max-budget-usd <amount>         (if specified)
```

Output parsing: JSON blob with `result` (text), `session_id`, `total_cost_usd`, `duration_ms`, `is_error`.

Model strings: `opus`, `opus[1m]`, `sonnet`, `sonnet[1m]`, `haiku`. The `[1m]` suffix enables 1M context window (billed as extra subscription usage).

### Codex adapter

Non-interactive mode: `exec` subcommand.

New session:
```
codex exec <message>
  --full-auto
  --json
  -m <model>                        (if overridden)
  -C <cwd>                          (working directory)
  --add-dir <path>                  (if specified)
```

Resume session:
```
codex exec resume <sessionId> <message>
  --full-auto
  --json
  -m <model>
  -C <cwd>
```

Output parsing: JSONL events on stdout. Extract final message text and session ID from event stream.

### Gemini adapter

Non-interactive mode: positional prompt (one-shot by default when output is not a TTY).

```
gemini <message>
  --output-format json              (default mode)
  --output-format stream-json       (verbose mode)
  --approval-mode yolo
  --resume <sessionId>              (if resuming)
  -m <model>                        (if overridden)
  --include-directories <path>      (if specified)
```

Output parsing: JSON blob similar to Claude. Extract result text and session identifier.

## Session Manager

### Storage

Single file: `~/.config/agent-cli/sessions.json`

```json
{
  "/home/dev/code/myapp": {
    "claude": {
      "id": "52ca1a42-cf11-4e16-93e6-128978e50ac0",
      "lastUsed": "2026-04-07T18:30:00Z"
    },
    "codex": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "lastUsed": "2026-04-07T14:00:00Z"
    }
  },
  "/home/dev/code/other-project": {
    "claude": {
      "id": "deadbeef-1234-5678-9abc-def012345678",
      "lastUsed": "2026-04-07T09:00:00Z"
    }
  }
}
```

### Session naming strategy

Default: keyed by `cwd + agent name`. No manual naming required for the common case.

Named sessions: stored as `agent:name`, e.g., `claude:auth`. Created via `--name auth`, resumed via `--resume auth` or `-r auth`.

```json
{
  "/home/dev/code/myapp": {
    "claude": { "id": "...", "lastUsed": "..." },
    "claude:auth": { "id": "...", "lastUsed": "..." },
    "claude:perf": { "id": "...", "lastUsed": "..." }
  }
}
```

### Session lifecycle

1. User runs `agent "msg"` in `/home/dev/code/myapp`
2. Session manager looks up `sessions[cwd]["claude"]`
3. Found → pass session ID to adapter via `--resume`
4. Not found → don't pass `--resume`, let CLI create new session
5. After run → parse session ID from JSON output, write back to sessions file
6. `--new` flag → skip step 2-3, always create fresh session

## Output Formatter

### Default mode

Uses `--output-format json`. Waits for CLI to finish, parses JSON, displays summary:

```
✓ Created JWT auth middleware in src/middleware/auth.ts
  and applied it to all 4 routes. Tests pass.

  Session: myapp-claude · 28s · $0.04
```

### Verbose mode (`-v`)

Uses `--output-format stream-json --verbose` (Claude/Gemini) or `--json` (Codex). Parses JSONL events in real-time:

- `assistant` text → stream to terminal
- `tool_use` (Read/Edit/Bash) → one-line status with summary
- `result` → final summary line with session/duration/cost

### JSON mode (`--json`)

Passes raw JSON output through unmodified. For scripting and downstream integration.

### Background mode (`--bg`)

1. Spawn CLI process detached
2. Redirect output to `~/.config/agent-cli/bg/{timestamp}-{agent}.json`
3. Print: `● Sent to claude (background) · run 'agent bg' to check status`
4. Return to shell immediately
5. On completion: fire terminal bell (`\a`) + macOS notification via `osascript`
6. `agent bg` reads the latest background result file and displays it

## Undo

Before each agent run:
1. Run `git diff HEAD --name-only` to capture list of tracked files that may change
2. Run `git stash create` to snapshot current state (creates git object without actually stashing)
3. Store in `~/.config/agent-cli/last-run.json`:

```json
{
  "dir": "/home/dev/code/myapp",
  "agent": "claude",
  "stashRef": "abc123def",
  "changedFiles": ["src/auth.ts", "src/routes/api.ts"],
  "timestamp": "2026-04-07T18:30:00Z"
}
```

`agent undo`:
- If stash ref exists and directory matches: `git checkout -- <changedFiles>` for clean reverts, or `git stash apply <ref>` if there was pre-existing uncommitted work
- One level of undo only (last run)

Only works if inside a git repo. Outside git repos, undo is not available (warn on first run).

## Configuration

### File location

`~/.config/agent-cli/config.json`

### Default config (created on first run)

```json
{
  "defaultAgent": "claude",
  "agents": {
    "claude": {
      "model": "opus",
      "effort": "high"
    },
    "codex": {
      "model": "o3"
    },
    "gemini": {
      "model": "gemini-2.5-pro"
    }
  }
}
```

### Config commands

```bash
agent config                        # print current config
agent config set claude.model sonnet  # set a value
agent config set defaultAgent codex   # change default agent
agent config path                   # print config file path
```

Dot-notation paths map to nested JSON keys.

## File Structure

```
agent-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── cli.ts              # entry point, argument parsing
│   ├── adapters/
│   │   ├── types.ts        # AgentAdapter interface, RunOpts, ParsedResult
│   │   ├── claude.ts       # Claude Code command builder + output parser
│   │   ├── codex.ts        # Codex command builder + output parser
│   │   └── gemini.ts       # Gemini command builder + output parser
│   ├── session.ts          # session manager (read/write sessions.json)
│   ├── runner.ts           # spawn process, pipe I/O, handle bg mode
│   ├── formatter.ts        # output formatting (default + verbose + json)
│   ├── config.ts           # config file management
│   ├── undo.ts             # git state snapshot + restore
│   └── commands/
│       ├── ls.ts           # list sessions
│       ├── log.ts          # show last turn output
│       ├── diff.ts         # git diff wrapper
│       └── bg.ts           # check background task status
├── test/
│   ├── cli.test.ts         # argument parsing tests
│   ├── session.test.ts     # session manager tests
│   ├── adapters/
│   │   ├── claude.test.ts  # claude command building + output parsing
│   │   ├── codex.test.ts   # codex command building + output parsing
│   │   └── gemini.test.ts  # gemini command building + output parsing
│   └── config.test.ts      # config management tests
├── bin/
│   ├── agent.js            # #!/usr/bin/env node shim
│   └── a.js                # #!/usr/bin/env node shim (same entry)
└── README.md
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| CLI not installed | `Error: codex not found. Install it with: npm i -g @openai/codex` |
| CLI auth expired | Pass through CLI's own error message |
| Session not found on resume | Fall back to new session, print warning |
| CLI crashes mid-run | Capture stderr, display it, exit non-zero |
| Invalid model string | Pass through CLI's error message |
| No message provided | Show help text |
| Piped stdin, no message arg | Use stdin content as entire message |
| Not a git repo (for undo) | Warn that undo is unavailable, continue normally |

Principle: pass through CLI errors. Don't reinterpret or hide them.

## Installation

```bash
cd ~/code/agent-cli
npm install
npm run build
npm link
```

This creates global symlinks for both `agent` and `a`. Works in every shell on the machine, including SSH sessions from Terminus and Shellfish.

### Build

- TypeScript compiled to `dist/` with `tsc`
- Target: ES2022, module: Node16
- No bundler — small enough that direct tsc output is fine

### Dependencies

Minimal:
- TypeScript (dev only)
- Node.js built-in test runner (dev only)
- No runtime dependencies beyond Node.js builtins

## Testing

Unit tests with Node's built-in test runner (`node --test`):

| Component | What to test |
|-----------|-------------|
| Argument parser | argv → parsed command. Agent name detection, flag extraction, message joining, subcommand routing |
| Session manager | CRUD on temp sessions file. Lookup by cwd+agent, named sessions, lastUsed updates |
| Claude adapter | RunOpts → string[] argv. Verify exact flags for new session, resume, model override, effort, verbose, budget |
| Codex adapter | RunOpts → string[] argv. Verify exec vs exec resume subcommand selection, flag mapping |
| Gemini adapter | RunOpts → string[] argv. Verify flag mapping, approval mode, include-directories |
| Output parsing | Sample JSON from each CLI → extracted text, session ID, cost, duration |
| Config manager | Read/write/set nested keys via dot notation |

No integration tests that call actual CLIs. The wrapper's value is in argument parsing, session tracking, and output formatting — all pure logic.

## Environment

- Node.js 25.4 (installed on target machine)
- macOS (Darwin, arm64)
- Target CLIs: Claude Code 2.1.94, Codex 0.117.0, Gemini CLI 0.25.0
- All CLIs installed globally and authenticated on the target machine
