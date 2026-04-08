import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { getConfigDir } from './config.js';

interface LastRun {
  dir: string;
  agent: string;
  stashRef: string;
  changedFiles: string[];
  timestamp: string;
}

function lastRunPath(): string {
  return path.join(getConfigDir(), 'last-run.json');
}

function isGitRepo(cwd: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function snapshotBeforeRun(cwd: string, agentName: string): void {
  if (!isGitRepo(cwd)) return;

  try {
    const changedFiles = execSync('git diff HEAD --name-only', { cwd, encoding: 'utf-8' })
      .trim().split('\n').filter(Boolean);
    const stashRef = execSync('git stash create', { cwd, encoding: 'utf-8' }).trim();

    const lastRun: LastRun = {
      dir: cwd,
      agent: agentName,
      stashRef: stashRef || '',
      changedFiles,
      timestamp: new Date().toISOString(),
    };

    const fp = lastRunPath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(lastRun, null, 2));
  } catch {
    // non-fatal — undo just won't be available
  }
}

export function performUndo(): void {
  const fp = lastRunPath();
  if (!fs.existsSync(fp)) {
    console.error('No previous run to undo.');
    process.exit(1);
  }

  const lastRun: LastRun = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  const cwd = process.cwd();

  if (lastRun.dir !== cwd) {
    console.error(`Last run was in ${lastRun.dir}, but you are in ${cwd}.`);
    console.error(`cd to ${lastRun.dir} and try again.`);
    process.exit(1);
  }

  if (!isGitRepo(cwd)) {
    console.error('Not a git repo. Undo is not available.');
    process.exit(1);
  }

  try {
    // Get files the agent changed (diff between now and before)
    const currentChanged = execSync('git diff HEAD --name-only', { cwd, encoding: 'utf-8' })
      .trim().split('\n').filter(Boolean);

    if (currentChanged.length === 0) {
      console.log('No changes to undo.');
      return;
    }

    if (lastRun.stashRef) {
      // Restore the pre-agent state
      execSync(`git stash apply ${lastRun.stashRef}`, { cwd, stdio: 'ignore' });
    } else {
      // No prior changes — just checkout the changed files
      for (const file of currentChanged) {
        try {
          execSync(`git checkout -- "${file}"`, { cwd, stdio: 'ignore' });
        } catch {
          // file might be new (untracked), skip
        }
      }
    }

    console.log(`Reverted ${currentChanged.length} file(s):`);
    for (const f of currentChanged) {
      console.log(`  ${f}`);
    }

    fs.unlinkSync(fp);
  } catch (err) {
    console.error(`Undo failed: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
