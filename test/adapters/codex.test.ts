import { describe, it } from 'node:test';
import assert from 'node:assert';
import { CodexAdapter } from '../../src/adapters/codex.js';

describe('codex adapter', () => {
  const adapter = new CodexAdapter();

  it('has correct name and aliases', () => {
    assert.strictEqual(adapter.name, 'codex');
    assert.deepStrictEqual(adapter.aliases, ['x']);
    assert.strictEqual(adapter.command, 'codex');
  });

  describe('buildArgs', () => {
    it('builds args for new session', () => {
      const args = adapter.buildArgs({
        message: 'fix the tests',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.deepStrictEqual(args, [
        'exec', 'fix the tests',
        '--full-auto', '--json',
        '-C', '/home/user/project',
      ]);
    });

    it('builds args for resumed session', () => {
      const args = adapter.buildArgs({
        message: 'continue',
        sessionId: 'abc-123',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.deepStrictEqual(args, [
        'exec', 'resume', 'abc-123', 'continue',
        '--full-auto', '--json',
        '-C', '/home/user/project',
      ]);
    });

    it('adds model flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        model: 'o4-mini',
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('-m'));
      assert.ok(args.includes('o4-mini'));
    });

    it('adds add-dir flag', () => {
      const args = adapter.buildArgs({
        message: 'do stuff',
        additionalDirs: ['/extra'],
        verbose: false,
        outputJson: false,
        cwd: '/home/user/project',
      });
      assert.ok(args.includes('--add-dir'));
      assert.ok(args.includes('/extra'));
    });
  });

  describe('parseResult', () => {
    it('parses JSONL output extracting last message', () => {
      const lines = [
        '{"type":"message","role":"assistant","content":"Working on it..."}',
        '{"type":"message","role":"assistant","content":"Done. Fixed 3 tests."}',
        '{"type":"session","session_id":"codex-abc-123"}'
      ].join('\n');
      const parsed = adapter.parseResult(lines);
      assert.strictEqual(parsed.text, 'Done. Fixed 3 tests.');
      assert.strictEqual(parsed.sessionId, 'codex-abc-123');
      assert.strictEqual(parsed.isError, false);
    });
  });
});
