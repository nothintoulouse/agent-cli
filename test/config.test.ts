import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig, setConfigValue, getConfigValue, DEFAULT_CONFIG, type AgentCliConfig } from '../src/config.js';

describe('config manager', () => {
  let tmpDir: string;
  let originalEnv: string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-cli-test-'));
    originalEnv = process.env.AGENT_CLI_CONFIG_DIR;
    process.env.AGENT_CLI_CONFIG_DIR = tmpDir;
  });

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.AGENT_CLI_CONFIG_DIR;
    else process.env.AGENT_CLI_CONFIG_DIR = originalEnv;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates default config on first load', () => {
    const config = loadConfig();
    assert.strictEqual(config.defaultAgent, 'claude');
    assert.strictEqual(config.agents.claude.model, 'opus');
    assert.strictEqual(config.agents.claude.effort, 'high');
    assert.strictEqual(config.agents.codex.model, 'o3');
    assert.strictEqual(config.agents.gemini.model, 'gemini-2.5-pro');
  });

  it('reads existing config from disk', () => {
    const custom: AgentCliConfig = {
      ...DEFAULT_CONFIG,
      defaultAgent: 'codex',
    };
    fs.writeFileSync(path.join(tmpDir, 'config.json'), JSON.stringify(custom));
    const config = loadConfig();
    assert.strictEqual(config.defaultAgent, 'codex');
  });

  it('sets nested value via dot notation', () => {
    const config = loadConfig();
    setConfigValue('agents.claude.model', 'sonnet');
    const updated = loadConfig();
    assert.strictEqual(updated.agents.claude.model, 'sonnet');
  });

  it('sets top-level value', () => {
    setConfigValue('defaultAgent', 'gemini');
    const updated = loadConfig();
    assert.strictEqual(updated.defaultAgent, 'gemini');
  });

  it('gets nested value via dot notation', () => {
    loadConfig();
    const val = getConfigValue('agents.codex.model');
    assert.strictEqual(val, 'o3');
  });

  it('returns undefined for missing key', () => {
    loadConfig();
    const val = getConfigValue('agents.codex.nonexistent');
    assert.strictEqual(val, undefined);
  });
});
