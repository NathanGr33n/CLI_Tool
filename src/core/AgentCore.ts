import * as fs from 'fs-extra';
import * as path from 'path';
import { 
  AgentConfig, 
  ProjectContext, 
  UserIntent, 
  AgentResponse, 
  AgentAction, 
  SessionContext,
  ChatMessage,
  FileInfo,
  GitInfo,
  PackageInfo,
  ToolResult
} from '../types';
import { Logger } from '../utils/Logger';
import { FileOperations } from './FileOperations';
import { CommandExecutor } from './CommandExecutor';
import { IntentParser } from './IntentParser';

export class AgentCore {
  private config: AgentConfig;
  private logger: Logger;
  private fileOps: FileOperations;
  private commandExec: CommandExecutor;
  private intentParser: IntentParser;
  private sessionContext: SessionContext;

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    
    // Initialize core modules
    this.fileOps = new FileOperations(
      logger,
      config.maxFileSize,
      config.allowedFileExtensions,
      config.forbiddenPaths
    );
    
    this.commandExec = new CommandExecutor(
      logger,
      config.safeCommands,
      config.dangerousCommands
    );
    
    this.intentParser = new IntentParser(logger);
    
    // Initialize session
    this.sessionContext = {
      id: this.generateSessionId(),
      startTime: new Date(),
      messages: [],
      projectContext: {
        rootPath: config.workingDirectory,
        files: [],
        dependencies: {},
        scripts: {}
      },
      currentDirectory: config.workingDirectory,
      environment: Object.fromEntries(
        Object.entries(process.env).filter(([_, v]) => v !== undefined)
      ) as Record<string, string>
    };
    
    this.logger.info('AgentCore initialized', { 
      sessionId: this.sessionContext.id,
      workingDirectory: config.workingDirectory 
    });
  }

  /**
   * Process a user message and return an agent response
   */
  async processMessage(message: string): Promise<AgentResponse> {
    try {
      this.logger.info('Processing user message', { message });
      
      // Add user message to context
      this.addMessage('user', message);
      
      // Parse user intent
      const intent = await this.intentParser.parseIntent(message, this.sessionContext);
      this.logger.debug('Parsed intent', { intent: intent.intent, confidence: intent.confidence });
      
      // Generate response based on intent
      const response = await this.generateResponse(intent);
      
      // Add agent response to context
      this.addMessage('agent', response.message, response.actions);
      
      return response;
    } catch (error) {
      this.logger.error('Failed to process message', error);
      return {
        message: 'I encountered an error processing your request. Please try again.',
        actions: [],
        needsConfirmation: false
      };
    }
  }

  /**
   * Execute a list of actions
   */
  async executeActions(actions: AgentAction[]): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    
    for (const action of actions) {
      try {
        this.logger.info(`Executing action: ${action.description}`);
        action.status = 'running';
        
        let result: ToolResult;
        
        switch (action.type) {
          case 'file':
            result = await this.fileOps.executeOperation(action.payload);
            break;
          
          case 'command':
            result = await this.commandExec.executeCommand(action.payload);
            break;
          
          case 'analysis':
            result = await this.performAnalysis(action.payload);
            break;
          
          default:
            result = {
              success: false,
              error: `Unknown action type: ${action.type}`
            };
        }
        
        action.status = result.success ? 'completed' : 'failed';
        action.result = result.data;
        action.error = result.error;
        
        results.push(result);
        
        this.logger.info(`Action ${result.success ? 'completed' : 'failed'}: ${action.description}`, {
          success: result.success,
          error: result.error
        });
        
      } catch (error) {
        action.status = 'failed';
        action.error = error instanceof Error ? error.message : 'Unknown error';
        
        const errorResult: ToolResult = {
          success: false,
          error: action.error
        };
        results.push(errorResult);
        
        this.logger.error(`Action failed: ${action.description}`, error);
      }
    }
    
    return results;
  }

  /**
   * Analyze the current project context
   */
  async analyzeProject(): Promise<ProjectContext> {
    try {
      this.logger.info('Analyzing project context');
      
      const rootPath = this.config.workingDirectory;
      const files = await this.scanProjectFiles(rootPath);
      const gitInfo = await this.getGitInfo(rootPath);
      const packageInfo = await this.getPackageInfo(rootPath);
      
      const context: ProjectContext = {
        rootPath,
        files,
        gitInfo,
        packageInfo,
        dependencies: packageInfo?.dependencies || {},
        scripts: packageInfo?.scripts || {}
      };
      
      this.sessionContext.projectContext = context;
      this.logger.info('Project analysis complete', {
        fileCount: files.length,
        hasGit: !!gitInfo,
        hasPackage: !!packageInfo
      });
      
      return context;
    } catch (error) {
      this.logger.error('Failed to analyze project', error);
      throw error;
    }
  }

  /**
   * Get current session context
   */
  getSessionContext(): SessionContext {
    return this.sessionContext;
  }

  /**
   * Get configuration
   */
  getConfig(): AgentConfig {
    return this.config;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Configuration updated');
  }

  /**
   * Generate a response based on parsed intent
   */
  private async generateResponse(intent: UserIntent): Promise<AgentResponse> {
    // For now, we'll implement basic responses
    // This can be enhanced with more sophisticated AI/ML models
    
    switch (intent.intent) {
      case 'file_read':
        return this.handleFileReadIntent(intent);
      
      case 'file_write':
        return this.handleFileWriteIntent(intent);
      
      case 'command_execute':
        return this.handleCommandIntent(intent);
      
      case 'project_analyze':
        return this.handleProjectAnalyzeIntent(intent);
      
      case 'help':
        return this.handleHelpIntent(intent);
      
      default:
        return {
          message: `I understand you want to ${intent.intent}, but I'm not sure how to help with that yet. Could you be more specific?`,
          actions: intent.suggestedActions,
          needsConfirmation: false,
          followUpQuestions: [
            'What specific file would you like to work with?',
            'What command would you like me to run?',
            'Would you like me to analyze the current project?'
          ]
        };
    }
  }

  private async handleFileReadIntent(intent: UserIntent): Promise<AgentResponse> {
    const fileEntity = intent.entities.find(e => e.type === 'file');
    
    if (!fileEntity) {
      return {
        message: 'I need to know which file you want me to read. Please specify a file path.',
        actions: [],
        needsConfirmation: false
      };
    }
    
    const action: AgentAction = {
      id: this.generateActionId(),
      type: 'file',
      description: `Read file: ${fileEntity.value}`,
      payload: {
        type: 'read',
        path: fileEntity.value
      },
      timestamp: new Date(),
      status: 'pending'
    };
    
    return {
      message: `I'll read the contents of ${fileEntity.value} for you.`,
      actions: [action],
      needsConfirmation: false
    };
  }

  private async handleFileWriteIntent(intent: UserIntent): Promise<AgentResponse> {
    const fileEntity = intent.entities.find(e => e.type === 'file');
    
    if (!fileEntity) {
      return {
        message: 'I need to know which file you want me to write to. Please specify a file path and content.',
        actions: [],
        needsConfirmation: false
      };
    }
    
    // This is a simplified implementation - in a real system, you'd extract content from the intent
    return {
      message: `To write to ${fileEntity.value}, I need the content. What would you like me to write?`,
      actions: [],
      needsConfirmation: false,
      followUpQuestions: ['What content should I write to the file?']
    };
  }

  private async handleCommandIntent(intent: UserIntent): Promise<AgentResponse> {
    const commandEntity = intent.entities.find(e => e.type === 'command');
    
    if (!commandEntity) {
      return {
        message: 'I need to know which command you want me to execute. Please specify a command.',
        actions: [],
        needsConfirmation: false
      };
    }
    
    const action: AgentAction = {
      id: this.generateActionId(),
      type: 'command',
      description: `Execute command: ${commandEntity.value}`,
      payload: {
        command: commandEntity.value,
        args: [],
        options: {
          cwd: this.sessionContext.currentDirectory
        }
      },
      timestamp: new Date(),
      status: 'pending'
    };
    
    return {
      message: `I'll execute the command: ${commandEntity.value}`,
      actions: [action],
      needsConfirmation: true // Commands should require confirmation for safety
    };
  }

  private async handleProjectAnalyzeIntent(intent: UserIntent): Promise<AgentResponse> {
    const action: AgentAction = {
      id: this.generateActionId(),
      type: 'analysis',
      description: 'Analyze project structure and context',
      payload: { type: 'project_analysis' },
      timestamp: new Date(),
      status: 'pending'
    };
    
    return {
      message: 'I\'ll analyze the current project structure and provide you with an overview.',
      actions: [action],
      needsConfirmation: false
    };
  }

  private async handleHelpIntent(intent: UserIntent): Promise<AgentResponse> {
    const helpMessage = `I'm your CLI agent assistant! Here's what I can help you with:

🗂️  **File Operations**
- Read file contents: "read package.json" or "show me the README"
- Write to files: "create a new file called test.js with console.log('hello')"
- Edit files: "replace 'old text' with 'new text' in myfile.js"

⚡ **Command Execution**
- Run commands: "run npm install" or "execute git status"
- System info: "show system information" or "list running processes"

📊 **Project Analysis**
- Analyze project: "analyze this project" or "show project structure"
- Git status: "check git status" or "show recent commits"

❓ **Tips**
- I can understand natural language - just tell me what you want to do!
- I'll ask for confirmation before running potentially destructive commands
- Use 'exit' or 'quit' to stop the session`;

    return {
      message: helpMessage,
      actions: [],
      needsConfirmation: false
    };
  }

  private async performAnalysis(payload: any): Promise<ToolResult> {
    try {
      switch (payload.type) {
        case 'project_analysis':
          const context = await this.analyzeProject();
          return {
            success: true,
            data: context
          };
        
        default:
          return {
            success: false,
            error: `Unknown analysis type: ${payload.type}`
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  private async scanProjectFiles(rootPath: string): Promise<FileInfo[]> {
    const result = await this.fileOps.listFiles(rootPath);
    return result.success ? result.data as FileInfo[] : [];
  }

  private async getGitInfo(rootPath: string): Promise<GitInfo | undefined> {
    try {
      // Check if .git directory exists
      const gitPath = path.join(rootPath, '.git');
      if (!await fs.pathExists(gitPath)) {
        return undefined;
      }

      // Get basic git info using command executor
      const branchResult = await this.commandExec.executeCommandString('git rev-parse --abbrev-ref HEAD');
      const statusResult = await this.commandExec.executeCommandString('git status --porcelain');
      const logResult = await this.commandExec.executeCommandString('git log -1 --pretty=format:"%H|%s|%an|%ai"');

      if (!branchResult.success) {
        return undefined;
      }

      const branch = branchResult.data.stdout.trim();
      const hasUncommittedChanges = statusResult.success && statusResult.data.stdout.trim().length > 0;
      
      let lastCommit: { hash: string; message: string; author: string; date: Date; } | undefined;
      if (logResult.success && logResult.data.stdout) {
        const [hash, message, author, date] = logResult.data.stdout.split('|');
        lastCommit = {
          hash: hash || 'unknown',
          message: message || 'unknown',
          author: author || 'unknown',
          date: new Date(date || Date.now())
        };
      }

      return {
        branch,
        hasUncommittedChanges,
        lastCommit
      };
    } catch (error) {
      this.logger.debug('Could not get git info', { error });
      return undefined;
    }
  }

  private async getPackageInfo(rootPath: string): Promise<PackageInfo | undefined> {
    try {
      const packageJsonPath = path.join(rootPath, 'package.json');
      
      if (await fs.pathExists(packageJsonPath)) {
        const content = await fs.readJSON(packageJsonPath);
        return {
          name: content.name || 'unknown',
          version: content.version || '0.0.0',
          description: content.description,
          main: content.main,
          scripts: content.scripts || {},
          dependencies: content.dependencies || {},
          devDependencies: content.devDependencies || {}
        };
      }
      
      // Could also check for other package files like Cargo.toml, requirements.txt, etc.
      return undefined;
    } catch (error) {
      this.logger.debug('Could not get package info', { error });
      return undefined;
    }
  }

  private addMessage(role: 'user' | 'agent', content: string, actions?: AgentAction[]): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date(),
      actions
    };
    
    this.sessionContext.messages.push(message);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
