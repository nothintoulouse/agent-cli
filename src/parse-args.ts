const AGENT_NAMES: Record<string, string> = {
  claude: 'claude', c: 'claude',
  codex: 'codex', x: 'codex',
  gemini: 'gemini', g: 'gemini',
};

const SUBCOMMANDS = new Set(['ls', 'log', 'diff', 'undo', 'bg', 'config', 'help']);

export interface ParsedArgs {
  agent: string;
  subcommand?: string;
  subcommandArgs?: string[];
  message: string;
  model?: string;
  effort?: string;
  verbose: boolean;
  newSession: boolean;
  sessionName?: string;
  resumeName?: string;
  background: boolean;
  outputJson: boolean;
  budget?: number;
  additionalDirs?: string[];
}

export function parseArgs(argv: string[], defaultAgent = 'claude'): ParsedArgs {
  if (argv.length === 0) {
    return { agent: defaultAgent, subcommand: 'help', message: '', verbose: false, newSession: false, background: false, outputJson: false };
  }

  let agent = defaultAgent;
  let subcommand: string | undefined;
  let subcommandArgs: string[] | undefined;
  let model: string | undefined;
  let effort: string | undefined;
  let verbose = false;
  let newSession = false;
  let sessionName: string | undefined;
  let resumeName: string | undefined;
  let background = false;
  let outputJson = false;
  let budget: number | undefined;
  let additionalDirs: string[] | undefined;

  const messageWords: string[] = [];
  let i = 0;

  // Check first arg for agent name or subcommand
  const first = argv[0];

  // Handle shell-quoted single arg containing spaces (e.g. 'claude is better than gemini')
  if (argv.length === 1 && first.includes(' ')) {
    const parts = first.split(' ');
    const firstWord = parts[0];
    if (AGENT_NAMES[firstWord] !== undefined) {
      return {
        agent: AGENT_NAMES[firstWord], subcommand, subcommandArgs,
        message: parts.slice(1).join(' '),
        model, effort, verbose, newSession,
        sessionName, resumeName,
        background, outputJson, budget, additionalDirs,
      };
    }
    return {
      agent, subcommand, subcommandArgs,
      message: first,
      model, effort, verbose, newSession,
      sessionName, resumeName,
      background, outputJson, budget, additionalDirs,
    };
  }

  if (SUBCOMMANDS.has(first)) {
    subcommand = first;
    subcommandArgs = argv.slice(1);
    return { agent, subcommand, subcommandArgs, message: '', verbose, newSession, background, outputJson };
  }
  if (first === '--help' || first === '-h') {
    return { agent, subcommand: 'help', message: '', verbose, newSession, background, outputJson };
  }
  if (AGENT_NAMES[first] !== undefined) {
    agent = AGENT_NAMES[first];
    i = 1;
  }

  // Parse remaining args
  for (; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '-m': case '--model':
        model = argv[++i];
        break;
      case '-e': case '--effort':
        effort = argv[++i];
        break;
      case '-v': case '--verbose':
        verbose = true;
        break;
      case '--new':
        newSession = true;
        break;
      case '-n': case '--name':
        sessionName = argv[++i];
        break;
      case '-r': case '--resume':
        resumeName = argv[++i];
        break;
      case '--bg':
        background = true;
        break;
      case '--json':
        outputJson = true;
        break;
      case '--budget':
        budget = parseFloat(argv[++i]);
        break;
      case '--add-dir':
        if (!additionalDirs) additionalDirs = [];
        additionalDirs.push(argv[++i]);
        break;
      default:
        messageWords.push(arg);
    }
  }

  return {
    agent, subcommand, subcommandArgs,
    message: messageWords.join(' '),
    model, effort, verbose, newSession,
    sessionName, resumeName,
    background, outputJson, budget, additionalDirs,
  };
}
