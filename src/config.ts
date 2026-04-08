import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface AgentConfig {
  model: string;
  effort?: string;
}

export interface AgentCliConfig {
  defaultAgent: string;
  agents: {
    claude: AgentConfig;
    codex: AgentConfig;
    gemini: AgentConfig;
  };
}

export const DEFAULT_CONFIG: AgentCliConfig = {
  defaultAgent: 'claude',
  agents: {
    claude: { model: 'opus', effort: 'high' },
    codex: { model: 'o3' },
    gemini: { model: 'gemini-2.5-pro' },
  },
};

function configDir(): string {
  return process.env.AGENT_CLI_CONFIG_DIR || path.join(os.homedir(), '.config', 'agent-cli');
}

function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export function getConfigDir(): string {
  return configDir();
}

export function loadConfig(): AgentCliConfig {
  const dir = configDir();
  const fp = configPath();

  if (!fs.existsSync(fp)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }

  const raw = fs.readFileSync(fp, 'utf-8');
  return JSON.parse(raw) as AgentCliConfig;
}

export function saveConfig(config: AgentCliConfig): void {
  const dir = configDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

export function setConfigValue(dotPath: string, value: string): void {
  const config = loadConfig();
  const keys = dotPath.split('.');
  let obj: any = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] === undefined) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  saveConfig(config);
}

export function getConfigValue(dotPath: string): unknown {
  const config = loadConfig();
  const keys = dotPath.split('.');
  let obj: any = config;
  for (const key of keys) {
    if (obj === undefined || obj === null) return undefined;
    obj = obj[key];
  }
  return obj;
}
