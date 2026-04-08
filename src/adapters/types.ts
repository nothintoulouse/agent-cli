export interface RunOpts {
  message: string;
  sessionId?: string;
  model?: string;
  effort?: string;
  verbose: boolean;
  outputJson: boolean;
  additionalDirs?: string[];
  budget?: number;
  cwd: string;
}

export interface ParsedResult {
  text: string;
  sessionId: string;
  cost?: number;
  duration?: number;
  isError: boolean;
}

export interface AgentAdapter {
  name: string;
  aliases: string[];
  command: string;
  buildArgs(opts: RunOpts): string[];
  parseResult(output: string): ParsedResult;
}
