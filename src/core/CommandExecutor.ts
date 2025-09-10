import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { CommandExecution, CommandResult, ToolResult } from '../types';
import { Logger } from '../utils/Logger';

export class CommandExecutor {
  private logger: Logger;
  private safeCommands: string[];
  private dangerousCommands: string[];
  private maxExecutionTime: number;

  constructor(
    logger: Logger,
    safeCommands: string[] = [],
    dangerousCommands: string[] = [],
    maxExecutionTime: number = 30000 // 30 seconds default
  ) {
    this.logger = logger;
    this.safeCommands = safeCommands.length > 0 ? safeCommands : this.getDefaultSafeCommands();
    this.dangerousCommands = dangerousCommands.length > 0 ? dangerousCommands : this.getDefaultDangerousCommands();
    this.maxExecutionTime = maxExecutionTime;
  }

  /**
   * Execute a command with security checks and proper output handling
   */
  async executeCommand(execution: CommandExecution): Promise<ToolResult> {
    try {
      // Security validation
      const securityCheck = this.validateCommandSecurity(execution.command);
      if (!securityCheck.allowed) {
        return {
          success: false,
          error: securityCheck.reason
        };
      }

      // Parse command and arguments
      const { command, args } = this.parseCommandString(execution.command, execution.args);
      
      // Execute the command
      const result = await this.runCommand(command, args, execution.options);
      
      this.logger.debug(`Command executed: ${execution.command} (exit code: ${result.exitCode})`);
      
      return {
        success: result.success,
        data: result,
        error: result.success ? undefined : result.stderr || 'Command failed'
      };
    } catch (error) {
      this.logger.error(`Command execution failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown execution error'
      };
    }
  }

  /**
   * Execute a command string directly (with parsing)
   */
  async executeCommandString(commandString: string, options: CommandExecution['options'] = {}): Promise<ToolResult> {
    const execution: CommandExecution = {
      command: commandString,
      args: [],
      options
    };
    
    return this.executeCommand(execution);
  }

  /**
   * Check if a command is safe to execute
   */
  private validateCommandSecurity(command: string): { allowed: boolean; reason?: string } {
    const normalizedCommand = command.toLowerCase().trim();
    
    // Check against dangerous commands
    for (const dangerous of this.dangerousCommands) {
      if (normalizedCommand.includes(dangerous.toLowerCase())) {
        return {
          allowed: false,
          reason: `Command contains dangerous operation: ${dangerous}`
        };
      }
    }

    // Extract the base command (first word)
    const baseCommand = normalizedCommand.split(' ')[0];
    
    // If safe commands are defined, only allow those
    if (this.safeCommands.length > 0) {
      const isAllowed = this.safeCommands.some(safe => 
        baseCommand === safe.toLowerCase() || normalizedCommand.startsWith(safe.toLowerCase())
      );
      
      if (!isAllowed) {
        return {
          allowed: false,
          reason: `Command not in allowed list: ${baseCommand}`
        };
      }
    }

    // Additional security checks
    if (this.containsSuspiciousPatterns(normalizedCommand)) {
      return {
        allowed: false,
        reason: 'Command contains suspicious patterns'
      };
    }

    return { allowed: true };
  }

  /**
   * Check for suspicious command patterns
   */
  private containsSuspiciousPatterns(command: string): boolean {
    const suspiciousPatterns = [
      /\|\s*sh\s*-c/,  // Pipe to shell
      /\|\s*bash\s*-c/, // Pipe to bash
      /\|\s*cmd\s*\/c/, // Pipe to cmd
      /\|\s*powershell/, // Pipe to PowerShell
      /&&\s*(rm|del|format)/, // Chain with destructive commands
      /;\s*(rm|del|format)/, // Sequence with destructive commands
      /curl.*\|\s*(sh|bash)/, // Download and execute
      /wget.*\|\s*(sh|bash)/, // Download and execute
      /(^|\s)eval\s/, // eval commands
      /(^|\s)exec\s/, // exec commands
    ];

    return suspiciousPatterns.some(pattern => pattern.test(command));
  }

  /**
   * Parse command string into command and arguments
   */
  private parseCommandString(commandString: string, additionalArgs: string[] = []): { command: string; args: string[] } {
    // Simple command parsing - can be enhanced with proper shell parsing library
    const parts = commandString.trim().split(/\s+/);
    const command = parts[0];
    const args = [...parts.slice(1), ...additionalArgs];
    
    return { command, args };
  }

  /**
   * Run the actual command
   */
  private runCommand(
    command: string, 
    args: string[], 
    options: CommandExecution['options'] = {}
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let stdout = '';
      let stderr = '';
      
      // Set up spawn options
      const spawnOptions: any = {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        shell: options.shell !== false, // Default to shell execution
        windowsHide: true, // Hide window on Windows
      };

      // Handle different platforms
      let actualCommand = command;
      let actualArgs = args;
      
      if (process.platform === 'win32' && options.shell !== false) {
        // On Windows, use cmd.exe for better compatibility
        actualCommand = 'cmd';
        actualArgs = ['/c', command, ...args];
      }

      this.logger.debug(`Executing: ${actualCommand} ${actualArgs.join(' ')}`);
      
      const childProcess: ChildProcess = spawn(actualCommand, actualArgs, spawnOptions);
      
      // Set up timeout
      const timeout = setTimeout(() => {
        childProcess.kill('SIGKILL');
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: stderr + '\nCommand timed out',
          duration: Date.now() - startTime
        });
      }, options.timeout || this.maxExecutionTime);
      
      // Collect stdout
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }
      
      // Collect stderr
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }
      
      // Handle process completion
      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        resolve({
          success: code === 0,
          exitCode: code || 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          duration
        });
      });
      
      // Handle process errors
      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        resolve({
          success: false,
          exitCode: -1,
          stdout,
          stderr: stderr + error.message,
          duration
        });
      });
    });
  }

  /**
   * Get default safe commands for different platforms
   */
  private getDefaultSafeCommands(): string[] {
    const commonSafe = [
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
    ];

    // Platform-specific commands
    if (process.platform === 'win32') {
      return [
        ...commonSafe,
        'powershell', 'pwsh', 'where', 'tasklist', 'systeminfo'
      ];
    } else {
      return [
        ...commonSafe,
        'which', 'locate', 'man', 'info'
      ];
    }
  }

  /**
   * Get default dangerous commands
   */
  private getDefaultDangerousCommands(): string[] {
    const commonDangerous = [
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
      'eval', 'exec', 'source', 'bash', 'sh', 'cmd',
      // Compression with overwrite
      'tar', 'zip', 'unzip', 'gzip', 'gunzip'
    ];

    // Platform-specific dangerous commands
    if (process.platform === 'win32') {
      return [
        ...commonDangerous,
        'reg', 'regedit', 'sc', 'net', 'netsh', 'wmic'
      ];
    } else {
      return [
        ...commonDangerous,
        'dd', 'crontab', 'service', 'systemctl', 'iptables'
      ];
    }
  }

  /**
   * Create a sandboxed execution environment (future enhancement)
   */
  private async createSandbox(): Promise<any> {
    // Future: Implement proper sandboxing
    // This could use Docker, chroot, or other containerization technologies
    return null;
  }

  /**
   * Get system information for context
   */
  async getSystemInfo(): Promise<ToolResult> {
    try {
      const info = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        cwd: process.cwd(),
        pid: process.pid,
        uptime: process.uptime()
      };

      return {
        success: true,
        data: info
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get system info'
      };
    }
  }

  /**
   * Test if a command is available on the system
   */
  async testCommand(command: string): Promise<boolean> {
    try {
      const testCmd = process.platform === 'win32' 
        ? `where ${command}`
        : `which ${command}`;
        
      const result = await this.executeCommandString(testCmd);
      return result.success;
    } catch {
      return false;
    }
  }
}
