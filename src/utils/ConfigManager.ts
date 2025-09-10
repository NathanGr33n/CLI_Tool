import * as fs from 'fs-extra';
import * as path from 'path';
import * as yaml from 'yaml';
import { AgentConfig } from '../types';

export class ConfigManager {
  private static readonly DEFAULT_CONFIG_NAME = '.cli-agent.yml';
  
  /**
   * Load configuration from file or create default
   */
  static async load(configPath?: string): Promise<AgentConfig> {
    const finalPath = configPath || this.getDefaultConfigPath();
    
    try {
      if (await fs.pathExists(finalPath)) {
        const content = await fs.readFile(finalPath, 'utf-8');
        const config = yaml.parse(content) as AgentConfig;
        return this.mergeWithDefaults(config);
      }
    } catch (error) {
      console.warn(`Warning: Could not load config from ${finalPath}:`, error);
    }
    
    // Return default configuration
    return this.getDefaultConfig();
  }

  /**
   * Save configuration to file
   */
  static async save(config: AgentConfig, configPath?: string): Promise<void> {
    const finalPath = configPath || this.getDefaultConfigPath();
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(finalPath));
    
    const yamlContent = yaml.stringify(config, {
      indent: 2,
      lineWidth: -1
    });
    
    await fs.writeFile(finalPath, yamlContent, 'utf-8');
  }

  /**
   * Create a new configuration file with defaults
   */
  static async init(configPath?: string, force: boolean = false): Promise<string> {
    const finalPath = configPath || this.getDefaultConfigPath();
    
    if (!force && await fs.pathExists(finalPath)) {
      throw new Error(`Configuration file already exists: ${finalPath}`);
    }
    
    const defaultConfig = this.getDefaultConfig();
    await this.save(defaultConfig, finalPath);
    
    return finalPath;
  }

  /**
   * Get default configuration path
   */
  private static getDefaultConfigPath(): string {
    return path.join(process.cwd(), this.DEFAULT_CONFIG_NAME);
  }

  /**
   * Get default configuration
   */
  private static getDefaultConfig(): AgentConfig {
    return {
      name: 'cli-agent',
      version: '1.0.0',
      workingDirectory: process.cwd(),
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedFileExtensions: [
        '.js', '.ts', '.jsx', '.tsx', '.json', '.yml', '.yaml',
        '.md', '.txt', '.py', '.java', '.c', '.cpp', '.h', '.hpp',
        '.css', '.scss', '.less', '.html', '.xml', '.sql', '.sh',
        '.bat', '.ps1', '.dockerfile', '.go', '.rs', '.rb', '.php'
      ],
      forbiddenPaths: [
        'node_modules',
        '.git',
        'dist',
        'build',
        '.next',
        '.cache',
        'coverage',
        'tmp',
        'temp'
      ],
      safeCommands: [
        // File operations
        'ls', 'dir', 'find', 'grep', 'cat', 'type', 'head', 'tail', 'wc',
        // Text processing
        'sed', 'awk', 'sort', 'uniq', 'cut',
        // Version control
        'git', 'svn', 'hg',
        // Package managers
        'npm', 'yarn', 'pip', 'composer', 'bundle', 'cargo', 'go',
        // Build tools
        'make', 'cmake', 'ninja', 'msbuild', 'dotnet',
        // Compilers and interpreters
        'node', 'python', 'python3', 'java', 'javac', 'gcc', 'g++', 'clang',
        // System info
        'ps', 'top', 'df', 'du', 'free', 'uname', 'whoami', 'id',
        // Network (read-only)
        'ping', 'nslookup', 'dig', 'curl', 'wget'
      ],
      dangerousCommands: [
        // File system destructive
        'rm', 'rmdir', 'del', 'deltree', 'format', 'fdisk',
        // System modification
        'chmod', 'chown', 'mount', 'umount', 'fsck',
        // Process management
        'kill', 'killall', 'taskkill',
        // Network operations
        'nc', 'netcat', 'telnet', 'ssh', 'scp', 'rsync',
        // System administration
        'sudo', 'su', 'runas', 'passwd', 'usermod', 'userdel',
        // Script execution
        'eval', 'exec', 'source', 'bash', 'sh', 'cmd'
      ]
    };
  }

  /**
   * Merge user config with defaults
   */
  private static mergeWithDefaults(userConfig: Partial<AgentConfig>): AgentConfig {
    const defaultConfig = this.getDefaultConfig();
    
    return {
      ...defaultConfig,
      ...userConfig,
      // Merge arrays instead of replacing
      allowedFileExtensions: [
        ...new Set([
          ...defaultConfig.allowedFileExtensions,
          ...(userConfig.allowedFileExtensions || [])
        ])
      ],
      forbiddenPaths: [
        ...new Set([
          ...defaultConfig.forbiddenPaths,
          ...(userConfig.forbiddenPaths || [])
        ])
      ],
      safeCommands: [
        ...new Set([
          ...defaultConfig.safeCommands,
          ...(userConfig.safeCommands || [])
        ])
      ],
      dangerousCommands: [
        ...new Set([
          ...defaultConfig.dangerousCommands,
          ...(userConfig.dangerousCommands || [])
        ])
      ]
    };
  }

  /**
   * Validate configuration
   */
  static validate(config: AgentConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!config.name || typeof config.name !== 'string') {
      errors.push('name must be a non-empty string');
    }
    
    if (!config.version || typeof config.version !== 'string') {
      errors.push('version must be a non-empty string');
    }
    
    if (!config.workingDirectory || typeof config.workingDirectory !== 'string') {
      errors.push('workingDirectory must be a non-empty string');
    }
    
    if (typeof config.maxFileSize !== 'number' || config.maxFileSize <= 0) {
      errors.push('maxFileSize must be a positive number');
    }
    
    if (!Array.isArray(config.allowedFileExtensions)) {
      errors.push('allowedFileExtensions must be an array');
    }
    
    if (!Array.isArray(config.forbiddenPaths)) {
      errors.push('forbiddenPaths must be an array');
    }
    
    if (!Array.isArray(config.safeCommands)) {
      errors.push('safeCommands must be an array');
    }
    
    if (!Array.isArray(config.dangerousCommands)) {
      errors.push('dangerousCommands must be an array');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get example configuration as YAML string
   */
  static getExampleConfig(): string {
    const example = this.getDefaultConfig();
    return yaml.stringify(example);
  }

  /**
   * Find configuration file in current directory or parent directories
   */
  static async findConfig(startDir: string = process.cwd()): Promise<string | null> {
    let currentDir = startDir;
    
    while (true) {
      const configPath = path.join(currentDir, this.DEFAULT_CONFIG_NAME);
      
      if (await fs.pathExists(configPath)) {
        return configPath;
      }
      
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        // Reached root directory
        break;
      }
      
      currentDir = parentDir;
    }
    
    return null;
  }
}
