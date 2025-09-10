export interface AgentConfig {
  name: string;
  version: string;
  workingDirectory: string;
  maxFileSize: number;
  allowedFileExtensions: string[];
  forbiddenPaths: string[];
  safeCommands: string[];
  dangerousCommands: string[];
}

export interface FileOperation {
  type: 'read' | 'write' | 'edit' | 'create' | 'delete';
  path: string;
  content?: string;
  lineNumber?: number;
  searchText?: string;
  replaceText?: string;
}

export interface CommandExecution {
  command: string;
  args: string[];
  options: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    shell?: boolean;
  };
}

export interface CommandResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface AgentAction {
  id: string;
  type: 'file' | 'command' | 'analysis' | 'plan';
  description: string;
  payload: FileOperation | CommandExecution | any;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface ProjectContext {
  rootPath: string;
  files: FileInfo[];
  gitInfo?: GitInfo;
  packageInfo?: PackageInfo;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  lastModified: Date;
  extension: string;
  isDirectory: boolean;
  content?: string;
}

export interface GitInfo {
  branch: string;
  hasUncommittedChanges: boolean;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: Date;
  };
}

export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  main?: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface UserIntent {
  originalMessage: string;
  intent: string;
  entities: Entity[];
  confidence: number;
  suggestedActions: AgentAction[];
}

export interface Entity {
  type: 'file' | 'command' | 'directory' | 'variable' | 'technology';
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface AgentResponse {
  message: string;
  actions: AgentAction[];
  needsConfirmation: boolean;
  followUpQuestions?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  warnings?: string[];
}

export interface ChatMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  actions?: AgentAction[];
}

export interface SessionContext {
  id: string;
  startTime: Date;
  messages: ChatMessage[];
  projectContext: ProjectContext;
  currentDirectory: string;
  environment: Record<string, string>;
}

// CLI Command interfaces
export interface CLICommand {
  name: string;
  description: string;
  aliases?: string[];
  args?: CLIArgument[];
  options?: CLIOption[];
  handler: (args: any, options: any) => Promise<void>;
}

export interface CLIArgument {
  name: string;
  description: string;
  required: boolean;
  variadic?: boolean;
}

export interface CLIOption {
  short?: string;
  long: string;
  description: string;
  type: 'string' | 'number' | 'boolean';
  default?: any;
  required?: boolean;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, any>;
}
