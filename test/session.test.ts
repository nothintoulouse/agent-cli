import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { SessionManager } from '../src/session.js';

describe('session manager', () => {
  let tmpDir: string;
  let sm: SessionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-session-'));
    sm = new SessionManager(path.join(tmpDir, 'sessions.json'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns undefined for unknown session', () => {
    const entry = sm.get('/some/dir', 'claude');
    assert.strictEqual(entry, undefined);
  });

  it('stores and retrieves a session', () => {
    sm.set('/some/dir', 'claude', 'abc-123');
    const entry = sm.get('/some/dir', 'claude');
    assert.ok(entry);
    assert.strictEqual(entry.id, 'abc-123');
    assert.ok(entry.lastUsed);
  });

  it('updates existing session', () => {
    sm.set('/some/dir', 'claude', 'abc-123');
    sm.set('/some/dir', 'claude', 'def-456');
    const entry = sm.get('/some/dir', 'claude');
    assert.strictEqual(entry?.id, 'def-456');
  });

  it('handles named sessions', () => {
    sm.set('/some/dir', 'claude:auth', 'named-123');
    const entry = sm.get('/some/dir', 'claude:auth');
    assert.strictEqual(entry?.id, 'named-123');

    // Default session is separate
    const defaultEntry = sm.get('/some/dir', 'claude');
    assert.strictEqual(defaultEntry, undefined);
  });

  it('lists all sessions sorted by recency', () => {
    sm.set('/dir/a', 'claude', 'a1');
    sm.set('/dir/b', 'codex', 'b1');
    sm.set('/dir/a', 'gemini', 'a2');

    const all = sm.listAll();
    assert.strictEqual(all.length, 3);
    // Most recent first
    assert.strictEqual(all[0].agent, 'gemini');
  });

  it('lists sessions for a specific directory', () => {
    sm.set('/dir/a', 'claude', 'a1');
    sm.set('/dir/a', 'codex', 'a2');
    sm.set('/dir/b', 'claude', 'b1');

    const sessions = sm.listForDir('/dir/a');
    assert.strictEqual(sessions.length, 2);
  });

  it('persists to disk', () => {
    sm.set('/dir/a', 'claude', 'persist-me');
    const sm2 = new SessionManager(path.join(tmpDir, 'sessions.json'));
    const entry = sm2.get('/dir/a', 'claude');
    assert.strictEqual(entry?.id, 'persist-me');
  });
});
