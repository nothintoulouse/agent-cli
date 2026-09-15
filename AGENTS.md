# AGENTS.md

Contract for agents/contributors working in this repo.

## What this is

A single-purpose TypeScript CLI (`src/cli.ts`) that dispatches to one of three
coding-agent adapters — `src/adapters/{claude,codex,gemini}.ts` — behind a
common invocation shape (`agent [agent] <message>`). Register new adapters in
`src/adapters/index.ts`.

## Commands

- `npm run build` — compile `src/` and `test/` to `dist/` via `tsc`.
- `npm test` — runs `node --test` against the **compiled** output
  (`dist/test/*.test.js`, `dist/test/**/*.test.js`); run `npm run build` first.
- `npm run dev` — `tsc --watch`.

## Adapter contract

A new adapter must implement `AgentAdapter` from `src/adapters/types.ts`:

```ts
export interface AgentAdapter {
  name: string;
  aliases: string[];
  command: string;
  buildArgs(opts: RunOpts): string[];
  parseResult(output: string): ParsedResult;
}
```

`RunOpts` includes optional `effort` and `budget` fields, but the type system
does not enforce that an adapter honors them. **Known gap:** today only
`claude.ts` reads `opts.effort`/`opts.budget` (`--effort`, `--max-budget-usd`);
`codex.ts` and `gemini.ts` silently drop both — no error, no warning. If you
add or modify an adapter, assume capabilities can silently degrade rather than
fail loudly, and check `buildArgs()` explicitly for any `RunOpts` field you
care about instead of trusting the interface alone.

## Undo invariants (read before touching `src/undo.ts`)

`src/undo.ts` is the most destructive code path in this tool — it runs after
all three adapters have already executed with their permission-bypass flags
enabled (`--dangerously-skip-permissions`, `--full-auto`, `--approval-mode
yolo`), and it has **zero test coverage** today.

Current behavior, as implemented (not necessarily as desired):

- `snapshotBeforeRun` records only `git diff HEAD --name-only` (tracked files)
  plus a `git stash create` ref. It never stashes with `-u`/`-a`, so
  **untracked files an agent creates are invisible to undo** — `agent undo`
  cannot remove new files, only revert tracked ones.
- `performUndo` falls back to per-file `git checkout -- <file>` when there is
  no stash ref, and wraps each checkout in a `try/catch` that **silently
  swallows failures**, assuming the failure means "file is new, skip it."
  That assumption isn't verified.

Treat any change to this file with extra caution: prefer adding tests
(temp git repos covering untracked files, no-stash fallback, and failure
paths) before changing behavior.
