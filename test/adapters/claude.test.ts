import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ClaudeAdapter } from '../../src/adapters/claude.js';

describe('claude adapter', () => {
  const adapter = new ClaudeAdapter();

  it('has correct name and aliases', () => {
    assert.strictEqual(adapter.name, 'claude');
    assert.deepStrictEqual(adapter.aliases, ['c']);
    assert.strictEqual(adapter.command, 'claude');
  });

  describe('buildArgs', () => {
    it('builds basic args for new session', () => {
      const args = adapter.buildArgs({
        message: 'fix the tests',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.deepStrictEqual(args, [
        '-p', 'fix the tests',
        '--output-format', 'json',
        '--dangerously-skip-permissions',
      ]);
    });

    it('adds --resume for existing session', () => {
      const args = adapter.buildArgs({
        message: 'continue',
        sessionId: 'abc-123',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--resume'));
      assert.ok(args.includes('abc-123'));
    });

    it('uses stream-json and --verbose for verbose mode', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        verbose: true,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('stream-json'));
      assert.ok(args.includes('--verbose'));
    });

    it('adds model flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        model: 'opus[1m]',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--model'));
      assert.ok(args.includes('opus[1m]'));
    });

    it('adds effort flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        effort: 'max',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--effort'));
      assert.ok(args.includes('max'));
    });

    it('adds budget flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        budget: 5.0,
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--max-budget-usd'));
      assert.ok(args.includes('5'));
    });

    it('adds add-dir flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        additionalDirs: ['/extra/dir'],
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--add-dir'));
      assert.ok(args.includes('/extra/dir'));
    });
  });

  describe('parseResult', () => {
    it('parses successful JSON output', () => {
      const output = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: false,
        result: 'Fixed the tests. All 12 passing.',
        session_id: 'abc-123-def',
        total_cost_usd: 0.04,
        duration_ms: 28000,
      });
      const parsed = adapter.parseResult(output);
      assert.strictEqual(parsed.text, 'Fixed the tests. All 12 passing.');
      assert.strictEqual(parsed.sessionId, 'abc-123-def');
      assert.strictEqual(parsed.cost, 0.04);
      assert.strictEqual(parsed.duration, 28000);
      assert.strictEqual(parsed.isError, false);
    });

    it('parses error output', () => {
      const output = JSON.stringify({
        type: 'result',
        subtype: 'success',
        is_error: true,
        result: 'Model not found',
        session_id: 'abc-123',
        total_cost_usd: 0,
        duration_ms: 100,
      });
      const parsed = adapter.parseResult(output);
      assert.strictEqual(parsed.isError, true);
      assert.strictEqual(parsed.text, 'Model not found');
    });
  });
});
