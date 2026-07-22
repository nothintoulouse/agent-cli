# agent-cli

One command for three coding agents. `agent "fix the failing test"` runs Claude Code, Codex, or Gemini CLI in the current directory, remembers the conversation per-project, and lets you undo whatever it changed.

```console
$ agent "add a --dry-run flag to the deploy script"
✓ Added --dry-run to scripts/deploy.sh. It prints the resolved plan and exits
  before any network call. Updated the usage block and added a test.
  claude · 34s · $0.12

$ agent diff          # review what it did
$ agent undo          # revert it
```

## Why this exists

Each agent CLI has its own flags, its own session model, and its own output format. Claude Code wants `-p` with `--output-format json` and a `--resume <uuid>`. Codex wants `exec resume <thread-id>` with `--json`. Gemini wants a bare positional prompt with `--output-format json`. Switching between them mid-task means remembering three dialects and hand-managing three sets of session IDs.

`agent-cli` puts one grammar over all three:

- **One invocation shape.** `agent [agent] <message>`, plus short aliases — `agent c`, `agent x`, `agent g`.
- **Sessions you don't have to track.** Session IDs are persisted per working directory, so a second `agent "…"` in the same repo continues the same conversation. Named sessions (`-n refactor`) are global and resumable from anywhere (`-r refactor`).
- **A shared result shape.** Every adapter parses its agent's native output into the same `{ text, sessionId, cost, duration, isError }` record, so the formatter, the exit code, and any downstream script behave identically regardless of which agent ran.
- **An undo path.** Before each run it takes a `git stash create` snapshot, so `agent undo` restores the pre-agent working tree.

## Architecture

```
parse-args ──> config ──> session ──┐
                                    ├──> adapter ──> runner ──> formatter
                                    │   (buildArgs)  (spawn)   (unify)
                          adapters ─┘
```

| Module | Responsibility |
|---|---|
| `src/parse-args.ts` | Agent/subcommand/flag detection. No I/O, fully unit-tested. |
| `src/config.ts` | `~/.config/agent-cli/config.json`, dot-notation get/set. |
| `src/session.ts` | Session store: directory-scoped by default, global for named sessions. |
| `src/adapters/*.ts` | Per-agent `buildArgs()` + `parseResult()`. The only agent-specific code. |
| `src/runner.ts` | Spawns the child process, streams in verbose mode, handles missing binaries. |
| `src/undo.ts` | Pre-run git snapshot and restore. |
| `src/formatter.ts` | Renders the unified result. |

**The adapter interface is the whole design.** Adding a fourth agent means implementing two methods:

```ts
export interface AgentAdapter {
  name: string;
  aliases: string[];
  command: string;
  buildArgs(opts: RunOpts): string[];
  parseResult(output: string): ParsedResult;
}
```

Everything else — sessions, config, undo, stdin, output formatting, exit codes — is agent-agnostic and needs no changes.

The three adapters exercise genuinely different shapes, which is what makes the abstraction worth having: Claude and Gemini emit a **single JSON object**, while Codex emits **JSON Lines** that must be folded event-by-event. The Codex parser also handles two output generations — the legacy `{type: "message"}` events and the current `item.completed` / `agent_message` envelope — because the format changed under it mid-project.

## Security model — read this before using it

**This tool runs every agent with its permission prompts disabled.** That is a deliberate design choice for unattended use, and it is the single most important thing to understand about it:

| Agent | Flag passed | Effect |
|---|---|---|
| Claude Code | `--dangerously-skip-permissions` | No approval prompts for file writes or commands. |
| Codex | `--full-auto` | Autonomous execution. |
| Gemini CLI | `--approval-mode yolo` | Auto-approves all tool calls. |

These are **not** safe defaults, and this README is not going to pretend otherwise. The agent can modify or delete files and execute arbitrary shell commands in the working directory without asking. The flags are passed unconditionally — there is currently no way to turn them off from the command line.

The mitigations that exist are real but partial:

- `agent undo` restores tracked files from a pre-run `git stash create` snapshot.
- The child process inherits `cwd` and only the directories granted via `--add-dir`.
- `--budget` caps spend on Claude runs.

The mitigations that **do not** exist: no sandbox, no container, no command allowlist, no network restriction, and no recovery for untracked files that the agent deletes.

Use it in a git repository with a clean working tree, on code you can afford to lose, and not on anything holding credentials you would not hand to a model. If you want prompts, run the underlying CLI directly — that is the safe path, and this tool is explicitly the unsafe convenience layer over it.

*Adding an opt-out flag that omits the bypass is the top item on the list below.*

## Install

Requires Node.js 20+ and at least one of the agent CLIs on `PATH` (`claude`, `codex`, `gemini`).

```bash
git clone https://github.com/nothintoulouse/agent-cli.git
cd agent-cli
npm install
npm run build
npm link          # provides `agent` and the shorter `a`
```

## Usage

```bash
agent "why is this test flaky?"          # default agent (configurable)
agent codex "port this module to ESM"    # pick an agent
a g "explain this regex"                 # aliases: c / x / g

agent -n refactor "start the auth refactor"   # name a session
agent -r refactor "now update the tests"      # resume it from any directory
agent --new "unrelated question"              # ignore stored session

git diff | agent "review this"           # stdin is appended to the message
agent --json "list the exported symbols" # raw agent JSON, for scripting
```

| Flag | Meaning |
|---|---|
| `-m, --model <model>` | Override the configured model. |
| `-e, --effort <level>` | Reasoning effort — Claude only. |
| `-v, --verbose` | Stream the agent's full output instead of the summary. |
| `-n, --name` / `-r, --resume` | Create / resume a global named session. |
| `--new` | Start a fresh session in this directory. |
| `--json` | Pass the agent's raw JSON straight through. |
| `--add-dir <path>` | Grant access to an additional directory. |
| `--budget <usd>` | Max spend — Claude only. |

**Subcommands:** `agent ls` (sessions, most recent first), `agent diff`, `agent undo`, `agent config [set <k> <v> | path]`, `agent help`.

### Stdin

When stdin is not a TTY it is read and appended to the message under a `---` separator, so `agent "review this"` and `git diff | agent "review this"` compose.

A message argument is still required: `git diff | agent` with no message prints help and exits without reading stdin. Piping alone is not enough.

### Configuration

`~/.config/agent-cli/config.json` (override the directory with `AGENT_CLI_CONFIG_DIR`), written with defaults on first run:

```jsonc
{
  "defaultAgent": "claude",
  "agents": {
    "claude": { "model": "opus", "effort": "high" },
    "codex":  { "model": "o3" },
    "gemini": { "model": "gemini-2.5-pro" }
  }
}
```

```bash
agent config                              # print current config
agent config set defaultAgent codex       # dot-notation set
agent config set agents.claude.model sonnet
```

## Tests

```bash
npm run build && npm test
```

58 tests across 16 suites, run on Node's built-in test runner with no test framework dependency. Coverage is deliberately concentrated on the pure logic — argument parsing, session storage and recency ordering, config dot-paths, and each adapter's `buildArgs`/`parseResult` against recorded fixture output from all three CLIs. Adapter tests assert on the **exact argv** each agent receives, which is what caught the Codex output-format change.

Process spawning and the agent CLIs themselves are not covered; those paths are exercised manually.

## Not implemented

Listed honestly, because the built-in help currently advertises them:

- `agent log` — prints `not yet implemented`.
- `agent bg` and the `--bg` flag — parsed, but no background execution exists.
- No opt-out from the permission-bypass flags described above.
- `agent undo` cannot restore files the agent created or deleted while untracked.

## How this was built

I designed and built this with heavy use of coding agents, and the repository shows the process rather than hiding it: `docs/superpowers/specs/` holds the design spec written before any code, and `docs/superpowers/plans/` holds the implementation plan it was built from. The commit history follows that plan module by module.

I specified the adapter abstraction, the session-scoping rules, and the security posture; used agents to draft implementations and tests; and personally reviewed, corrected, and verified the result — including diagnosing the Codex output-format change and writing the two-generation parser that handles it. The claims in this README were checked against the source, not against the design docs: the "Not implemented" section exists because the code and the help text disagreed.

## License

MIT — see [LICENSE](LICENSE). All source is original work; the only dependencies are TypeScript and `@types/node`, both development-only.
