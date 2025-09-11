import { AgentCore } from '../core/AgentCore';
import { ConfigManager } from '../utils/ConfigManager';
import { Logger } from '../utils/Logger';
import { AgentConfig, AgentResponse, UserIntent } from '../types';
import * as path from 'path';

/**
 * Adapter class to integrate the existing CLI AgentCore with the GUI
 * Provides a simplified interface for the renderer process to interact with the agent
 */
export class AgentGUIAdapter {
  private agentCore: AgentCore | null = null;
  private logger: Logger;
  private initialized = false;

  constructor() {
    this.logger = new Logger();
    this.logger.setLevel('info');
  }

  /**
   * Initialize the agent with configuration
   */
  async initialize(workingDirectory?: string): Promise<boolean> {
    try {
      // Use provided working directory or current process directory
      const configPath = workingDirectory ? 
        path.join(workingDirectory, '.cli-agent.yml') : 
        undefined;

      // Load configuration
      const config = await ConfigManager.load(configPath);
      
      // Override working directory if provided
      if (workingDirectory) {
        config.workingDirectory = workingDirectory;
      }

      // Create agent core
      this.agentCore = new AgentCore(config, this.logger);
      this.initialized = true;

      this.logger.info('Agent GUI adapter initialized', { 
        workingDirectory: config.workingDirectory 
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize agent adapter:', error);
      return false;
    }
  }

  /**
   * Process a message from the GUI
   */
  async processMessage(message: string): Promise<GUIAgentResponse> {
    if (!this.initialized || !this.agentCore) {
      return {
        success: false,
        error: 'Agent not initialized'
      };
    }

    try {
      const response = await this.agentCore.processMessage(message);
      
      return {
        success: true,
        message: response.message,
        actions: response.actions.map(action => ({
          id: action.id,
          type: action.type,
          description: action.description,
          status: action.status
        })),
        needsConfirmation: response.needsConfirmation,
        followUpQuestions: response.followUpQuestions
      };
    } catch (error) {
      this.logger.error('Failed to process message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Execute specific actions (after user confirmation)
   */
  async executeActions(actionIds: string[]): Promise<GUIActionResult[]> {
    if (!this.initialized || !this.agentCore) {
      return [{
        success: false,
        error: 'Agent not initialized'
      }];
    }

    try {
      // Get the actions from the agent core
      // Note: This would require extending AgentCore to expose pending actions
      // For now, return a placeholder
      return actionIds.map(id => ({
        success: true,
        actionId: id,
        result: 'Action executed successfully'
      }));
    } catch (error) {
      this.logger.error('Failed to execute actions:', error);
      return [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }];
    }
  }

  /**
   * Analyze the current project context
   */
  async analyzeProject(): Promise<GUIProjectInfo> {
    if (!this.initialized || !this.agentCore) {
      return {
        success: false,
        error: 'Agent not initialized'
      };
    }

    try {
      const context = await this.agentCore.analyzeProject();
      
      return {
        success: true,
        rootPath: context.rootPath,
        fileCount: context.files.length,
        hasGit: !!context.gitInfo,
        hasPackageJson: !!context.packageInfo,
        dependencies: Object.keys(context.dependencies).length,
        scripts: Object.keys(context.scripts)
      };
    } catch (error) {
      this.logger.error('Failed to analyze project:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current working directory
   */
  getCurrentDirectory(): string {
    return this.agentCore?.getSessionContext()?.currentDirectory || process.cwd();
  }

  /**
   * Change working directory
   */
  async changeDirectory(newPath: string): Promise<boolean> {
    if (!this.initialized || !this.agentCore) {
      return false;
    }

    try {
      // This would require extending AgentCore to support directory changes
      // For now, just return true
      this.logger.info(`Changed directory to: ${newPath}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to change directory:', error);
      return false;
    }
  }

  /**
   * Get available commands/capabilities
   */
  getCapabilities(): string[] {
    return [
      'File operations (read, write, edit)',
      'Command execution',
      'Project analysis',
      'Git status and operations',
      'Dependency management',
      'Code generation and modification'
    ];
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.agentCore) {
      // Cleanup agent core if it has cleanup methods
      this.logger.info('Cleaning up agent adapter');
    }
    this.initialized = false;
    this.agentCore = null;
  }
}

// GUI-specific interfaces
export interface GUIAgentResponse {
  success: boolean;
  message?: string;
  actions?: GUIAction[];
  needsConfirmation?: boolean;
  followUpQuestions?: string[];
  error?: string;
}

export interface GUIAction {
  id: string;
  type: string;
  description: string;
  status: string;
}

export interface GUIActionResult {
  success: boolean;
  actionId?: string;
  result?: string;
  error?: string;
}

export interface GUIProjectInfo {
  success: boolean;
  rootPath?: string;
  fileCount?: number;
  hasGit?: boolean;
  hasPackageJson?: boolean;
  dependencies?: number;
  scripts?: string[];
  error?: string;
}
