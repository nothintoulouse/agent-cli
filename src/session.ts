import fs from 'node:fs';
import path from 'node:path';

export interface SessionEntry {
  id: string;
  lastUsed: string;
}

interface InternalSessionEntry extends SessionEntry {
  seq: number;
}

interface SessionStore {
  _seq: number;
  [dir: string]: { [agentKey: string]: InternalSessionEntry } | number;
}

export interface SessionListItem {
  dir: string;
  agent: string;
  id: string;
  lastUsed: string;
}

export class SessionManager {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private load(): SessionStore {
    if (!fs.existsSync(this.filePath)) return { _seq: 0 };
    const raw = fs.readFileSync(this.filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SessionStore;
    if (typeof parsed._seq !== 'number') parsed._seq = 0;
    return parsed;
  }

  private save(store: SessionStore): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(store, null, 2));
  }

  get(dir: string, agentKey: string): SessionEntry | undefined {
    const store = this.load();

    // Named sessions (e.g. "claude:colors") are global — stored under _named
    if (agentKey.includes(':')) {
      const named = store['_named'];
      if (!named || typeof named === 'number') return undefined;
      const entry = (named as { [k: string]: InternalSessionEntry })[agentKey];
      if (!entry) return undefined;
      return { id: entry.id, lastUsed: entry.lastUsed };
    }

    const dirStore = store[dir];
    if (!dirStore || typeof dirStore === 'number') return undefined;
    const entry = (dirStore as { [k: string]: InternalSessionEntry })[agentKey];
    if (!entry) return undefined;
    return { id: entry.id, lastUsed: entry.lastUsed };
  }

  set(dir: string, agentKey: string, sessionId: string): void {
    const store = this.load();
    store._seq = (store._seq as number) + 1;
    const seq = store._seq as number;
    const entry: InternalSessionEntry = {
      id: sessionId,
      lastUsed: new Date().toISOString(),
      seq,
    };

    // Named sessions are global — stored under _named
    if (agentKey.includes(':')) {
      if (!store['_named']) store['_named'] = {};
      (store['_named'] as { [k: string]: InternalSessionEntry })[agentKey] = entry;
    } else {
      if (!store[dir]) store[dir] = {};
      (store[dir] as { [k: string]: InternalSessionEntry })[agentKey] = entry;
    }

    this.save(store);
  }

  listAll(): SessionListItem[] {
    const store = this.load();
    const items: Array<SessionListItem & { seq: number }> = [];
    for (const [key, value] of Object.entries(store)) {
      if (key === '_seq' || typeof value === 'number') continue;
      const agents = value as { [k: string]: InternalSessionEntry };
      for (const [agent, entry] of Object.entries(agents)) {
        items.push({ dir: key, agent, id: entry.id, lastUsed: entry.lastUsed, seq: entry.seq });
      }
    }
    items.sort((a, b) => b.seq - a.seq);
    return items.map(({ dir, agent, id, lastUsed }) => ({ dir, agent, id, lastUsed }));
  }

  listForDir(dir: string): SessionListItem[] {
    const store = this.load();
    const dirStore = store[dir];
    if (!dirStore || typeof dirStore === 'number') return [];
    const agents = dirStore as { [k: string]: InternalSessionEntry };
    return Object.entries(agents)
      .map(([agent, entry]) => ({
        dir,
        agent,
        id: entry.id,
        lastUsed: entry.lastUsed,
        seq: entry.seq,
      }))
      .sort((a, b) => b.seq - a.seq)
      .map(({ dir: d, agent, id, lastUsed }) => ({ dir: d, agent, id, lastUsed }));
  }
}
