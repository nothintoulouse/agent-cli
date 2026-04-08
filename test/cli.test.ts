import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseArgs, type ParsedArgs } from '../src/parse-args.js';

describe('argument parser', () => {
  describe('agent detection', () => {
    it('defaults to claude when no agent specified', () => {
      const result = parseArgs(['fix', 'the', 'tests']);
      assert.strictEqual(result.agent, 'claude');
      assert.strictEqual(result.message, 'fix the tests');
    });

    it('detects agent by full name', () => {
      const result = parseArgs(['codex', 'refactor', 'auth']);
      assert.strictEqual(result.agent, 'codex');
      assert.strictEqual(result.message, 'refactor auth');
    });

    it('detects agent by alias', () => {
      const result = parseArgs(['x', 'refactor', 'auth']);
      assert.strictEqual(result.agent, 'codex');
      assert.strictEqual(result.message, 'refactor auth');
    });

    it('detects gemini by alias g', () => {
      const result = parseArgs(['g', 'review', 'code']);
      assert.strictEqual(result.agent, 'gemini');
      assert.strictEqual(result.message, 'review code');
    });
  });

  describe('subcommands', () => {
    it('detects ls subcommand', () => {
      const result = parseArgs(['ls']);
      assert.strictEqual(result.subcommand, 'ls');
    });

    it('detects config subcommand with args', () => {
      const result = parseArgs(['config', 'set', 'claude.model', 'sonnet']);
      assert.strictEqual(result.subcommand, 'config');
      assert.deepStrictEqual(result.subcommandArgs, ['set', 'claude.model', 'sonnet']);
    });

    it('detects help', () => {
      const result = parseArgs(['help']);
      assert.strictEqual(result.subcommand, 'help');
    });

    it('detects undo', () => {
      const result = parseArgs(['undo']);
      assert.strictEqual(result.subcommand, 'undo');
    });

    it('detects bg', () => {
      const result = parseArgs(['bg']);
      assert.strictEqual(result.subcommand, 'bg');
    });
  });

  describe('flags', () => {
    it('parses --model flag', () => {
      const result = parseArgs(['-m', 'opus', 'do', 'stuff']);
      assert.strictEqual(result.model, 'opus');
      assert.strictEqual(result.message, 'do stuff');
    });

    it('parses --effort flag', () => {
      const result = parseArgs(['-e', 'max', 'do', 'stuff']);
      assert.strictEqual(result.effort, 'max');
    });

    it('parses --verbose flag', () => {
      const result = parseArgs(['-v', 'do', 'stuff']);
      assert.strictEqual(result.verbose, true);
    });

    it('parses --new flag', () => {
      const result = parseArgs(['--new', 'start', 'fresh']);
      assert.strictEqual(result.newSession, true);
      assert.strictEqual(result.message, 'start fresh');
    });

    it('parses --name flag', () => {
      const result = parseArgs(['-n', 'auth', 'set', 'up', 'auth']);
      assert.strictEqual(result.sessionName, 'auth');
      assert.strictEqual(result.message, 'set up auth');
    });

    it('parses --resume flag', () => {
      const result = parseArgs(['-r', 'auth', 'continue']);
      assert.strictEqual(result.resumeName, 'auth');
      assert.strictEqual(result.message, 'continue');
    });

    it('parses --bg flag', () => {
      const result = parseArgs(['--bg', 'run', 'full', 'suite']);
      assert.strictEqual(result.background, true);
    });

    it('parses --json flag', () => {
      const result = parseArgs(['--json', 'do', 'stuff']);
      assert.strictEqual(result.outputJson, true);
    });

    it('parses --budget flag', () => {
      const result = parseArgs(['--budget', '5', 'expensive', 'task']);
      assert.strictEqual(result.budget, 5);
      assert.strictEqual(result.message, 'expensive task');
    });

    it('parses --add-dir flag', () => {
      const result = parseArgs(['--add-dir', '/extra', 'do', 'stuff']);
      assert.deepStrictEqual(result.additionalDirs, ['/extra']);
    });

    it('parses agent + flags + message together', () => {
      const result = parseArgs(['codex', '-m', 'o4-mini', '-v', 'fix', 'everything']);
      assert.strictEqual(result.agent, 'codex');
      assert.strictEqual(result.model, 'o4-mini');
      assert.strictEqual(result.verbose, true);
      assert.strictEqual(result.message, 'fix everything');
    });
  });

  describe('edge cases', () => {
    it('handles empty args', () => {
      const result = parseArgs([]);
      assert.strictEqual(result.subcommand, 'help');
    });

    it('treats quoted message starting with agent name as message', () => {
      // When user wraps in quotes, shell passes it as one arg
      const result = parseArgs(['claude is better than gemini']);
      assert.strictEqual(result.agent, 'claude');
      assert.strictEqual(result.message, 'is better than gemini');
    });
  });
});
