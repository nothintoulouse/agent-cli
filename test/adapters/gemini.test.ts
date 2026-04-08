import { describe, it } from 'node:test';
import assert from 'node:assert';
import { GeminiAdapter } from '../../src/adapters/gemini.js';

describe('gemini adapter', () => {
  const adapter = new GeminiAdapter();

  it('has correct name and aliases', () => {
    assert.strictEqual(adapter.name, 'gemini');
    assert.deepStrictEqual(adapter.aliases, ['g']);
    assert.strictEqual(adapter.command, 'gemini');
  });

  describe('buildArgs', () => {
    it('builds args for new session', () => {
      const args = adapter.buildArgs({
        message: 'review the code',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.deepStrictEqual(args, [
        'review the code',
        '--output-format', 'json',
        '--approval-mode', 'yolo',
      ]);
    });

    it('adds resume flag for existing session', () => {
      const args = adapter.buildArgs({
        message: 'continue',
        sessionId: '5',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--resume'));
      assert.ok(args.includes('5'));
    });

    it('uses stream-json for verbose mode', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        verbose: true,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('stream-json'));
    });

    it('adds model flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        model: 'gemini-2.5-flash',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('-m'));
      assert.ok(args.includes('gemini-2.5-flash'));
    });

    it('adds include-directories flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        additionalDirs: ['/extra'],
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--include-directories'));
      assert.ok(args.includes('/extra'));
    });
  });

  describe('parseResult', () => {
    it('parses JSON output', () => {
      const output = JSON.stringify({
        result: 'Code looks good. No issues found.',
        session_id: 'gem-456',
        is_error: false,
      });
      const parsed = adapter.parseResult(output);
      assert.strictEqual(parsed.text, 'Code looks good. No issues found.');
      assert.strictEqual(parsed.sessionId, 'gem-456');
      assert.strictEqual(parsed.isError, false);
    });
  });
});
