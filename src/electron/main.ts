import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { AgentGUIAdapter } from './agent-adapter';
import { GPUManager } from './gpu-config';

// Configure GPU settings early, before app is ready
GPUManager.autoConfiguration();

interface ShellSession {
  id: string;
  type: 'powershell' | 'cmd' | 'wsl' | 'bash';
  process: ChildProcess;
  title: string;
  ready: boolean;
  lineBuffer: string;
  cursorPosition: number;
}

class TerminalManager {
  private sessions: Map<string, ShellSession> = new Map();
  private sessionCounter = 0;

  createSession(type: 'powershell' | 'cmd' | 'wsl' | 'bash'): string {
    const sessionId = `session-${++this.sessionCounter}`;
    
    let shellCommand: string;
    let shellArgs: string[] = [];
    let title: string;
    
    console.log(`🔧 Creating ${type} shell session...`);

    switch (type) {
      case 'powershell':
        shellCommand = 'powershell.exe';
        shellArgs = ['-NoLogo', '-NoExit', '-NoProfile'];
        title = 'PowerShell';
        break;
      case 'cmd':
        shellCommand = 'cmd.exe';
        shellArgs = ['/Q', '/K'];
        title = 'Command Prompt';
        break;
      case 'wsl':
        shellCommand = 'wsl.exe';
        shellArgs = ['--', 'bash', '-l'];
        title = 'WSL';
        break;
      case 'bash':
        shellCommand = process.platform === 'win32' ? 'bash.exe' : 'bash';
        shellArgs = ['--login', '-i'];
        title = 'Bash';
        break;
      default:
        console.error(`❌ Unsupported shell type: ${type}`);
        throw new Error(`Unsupported shell type: ${type}`);
    }

    try {
      console.log(`🚀 Spawning ${shellCommand} with args:`, shellArgs);
      
      const childProcess = spawn(shellCommand, shellArgs, {
        cwd: os.homedir(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLUMNS: '120',
          LINES: '30',
          FORCE_COLOR: '1',
          // Windows-specific environment for better terminal behavior
          PROMPT: '$P$G', // Simple prompt for CMD
          // PowerShell-specific settings
          PSReadLineOption_BellStyle: 'None',
          PSReadLineOption_EditMode: 'Emacs'
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
        detached: false
      });
      
      // Verify the process started successfully
      if (!childProcess || !childProcess.pid) {
        throw new Error('Failed to spawn process - no PID assigned');
      }
      
      console.log(`✓ Process spawned with PID: ${childProcess.pid}`);

      const session: ShellSession = {
        id: sessionId,
        type,
        process: childProcess,
        title,
        ready: false,
        lineBuffer: '',
        cursorPosition: 0
      };

      this.sessions.set(sessionId, session);

      // Handle process cleanup
      childProcess.on('exit', (code, signal) => {
        console.log(`🚪 Process ${sessionId} exited with code ${code}, signal ${signal}`);
        this.sessions.delete(sessionId);
      });
      
      childProcess.on('error', (error) => {
        console.error(`❌ Process error for ${sessionId}:`, error);
        this.sessions.delete(sessionId);
      });
      
      // Mark session as ready after a longer delay to ensure proper initialization
      setTimeout(() => {
        if (this.sessions.has(sessionId)) {
          this.sessions.get(sessionId)!.ready = true;
          console.log(`✓ Session ${sessionId} marked as ready`);
        }
      }, 1000);

      return sessionId;
    } catch (error) {
      console.error(`❌ Failed to create ${type} session:`, error);
      throw new Error(`Failed to create ${type} session: ${(error as Error).message}`);
    }
  }

  getSession(sessionId: string): ShellSession | undefined {
    return this.sessions.get(sessionId);
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.error(`❌ Session not found: ${sessionId}`);
      return false;
    }
    
    if (!session.process.stdin || session.process.stdin.destroyed) {
      console.error(`❌ No stdin available for session: ${sessionId}`);
      return false;
    }
    
    try {
      // Log the input data for debugging
      console.log(`🔢 Shell input [${sessionId}]:`, JSON.stringify(data), `(codes: ${Array.from(data).map(c => c.charCodeAt(0)).join(',')})`);
      
      // Handle special characters with line buffering for proper backspace support
      if (data === '\r') {
        // Enter key - send buffered line to shell
        console.log(`🔄 Sending complete line to ${session.type}:`, JSON.stringify(session.lineBuffer));
        session.process.stdin.write(session.lineBuffer + '\r\n');
        // Reset line buffer
        session.lineBuffer = '';
        session.cursorPosition = 0;
      } else if (data === '\u0003') {
        // Handle Ctrl+C (SIGINT)
        console.log(`🛑 Sending SIGINT to ${session.type}`);
        session.process.kill('SIGINT');
        // Clear line buffer
        session.lineBuffer = '';
        session.cursorPosition = 0;
      } else if (data === '\u0004') {
        // Handle Ctrl+D (EOF)
        console.log(`🔚 Ending stdin for ${session.type}`);
        session.process.stdin.end();
      } else if (data === '\u0008' || data === '\u007f') {
        // Handle Backspace - implement local echo with backspace
        if (session.lineBuffer.length > 0 && session.cursorPosition > 0) {
          console.log(`⌫ Backspace - removing character at position ${session.cursorPosition - 1}`);
          // Remove character from buffer
          session.lineBuffer = session.lineBuffer.slice(0, session.cursorPosition - 1) + 
                               session.lineBuffer.slice(session.cursorPosition);
          session.cursorPosition--;
          
          // Send backspace sequence to terminal for visual feedback
          console.log(`📡 Sending backspace visual feedback`);
          this.sendToRenderer(sessionId, '\b \b');  // backspace, space, backspace
        } else {
          console.log(`⚠️ Backspace ignored - at beginning of line`);
        }
      } else if (data === '\u001b') {
        // Handle Escape sequences (arrow keys, etc.)
        console.log(`🔄 Sending escape sequence to ${session.type}`);
        session.process.stdin.write(data);
      } else if (data.startsWith('\u001b[')) {
        // Handle ANSI escape sequences (arrow keys, function keys, etc.)
        console.log(`📡 Sending ANSI escape sequence to ${session.type}:`, data);
        session.process.stdin.write(data);
      } else if (data === '\t') {
        // Handle Tab for autocompletion - send current buffer + tab
        console.log(`📋 Sending tab completion for:`, JSON.stringify(session.lineBuffer));
        session.process.stdin.write(session.lineBuffer + '\t');
      } else if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) < 127) {
        // Regular printable characters - add to line buffer
        session.lineBuffer = session.lineBuffer.slice(0, session.cursorPosition) + 
                           data + 
                           session.lineBuffer.slice(session.cursorPosition);
        session.cursorPosition++;
        console.log(`📝 Added character to buffer:`, JSON.stringify(session.lineBuffer), `cursor at ${session.cursorPosition}`);
        
        // Send character to terminal for visual feedback
        this.sendToRenderer(sessionId, data);
      } else {
        // Other characters - send directly to process
        console.log(`🔄 Sending other character directly to ${session.type}`);
        session.process.stdin.write(data);
      }
      return true;
    } catch (error) {
      console.error(`❌ Failed to write to session ${sessionId}:`, error);
      return false;
    }
  }

  killSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.process.kill();
      this.sessions.delete(sessionId);
      return true;
    }
    return false;
  }

  initializeShellSession(session: ShellSession): void {
    console.log(`🔧 Initializing ${session.type} session ${session.id}...`);
    
    // Send initial commands to set up the shell for better terminal interaction
    setTimeout(() => {
      if (!session.process || session.process.killed) {
        console.warn(`⚠️  Cannot initialize ${session.id} - process not available`);
        return;
      }
      
      if (session.type === 'cmd') {
        // For CMD, set simple prompt without clearing
        console.log(`🔧 Setting up CMD session ${session.id}`);
        try {
          session.process.stdin?.write('prompt $P$G\r\n');
        } catch (error) {
          console.error(`❌ Error initializing CMD session:`, error);
        }
      } else if (session.type === 'powershell') {
        // For PowerShell, just show ready message without clearing
        console.log(`🔧 Setting up PowerShell session ${session.id}`);
        try {
          // Don't clear host immediately, let initial output show
          session.process.stdin?.write('Write-Host "PowerShell Terminal Ready"\r\n');
        } catch (error) {
          console.error(`❌ Error initializing PowerShell session:`, error);
        }
      } else if (session.type === 'wsl' || session.type === 'bash') {
        // For WSL/Bash, show ready message
        console.log(`🔧 Setting up ${session.type} session ${session.id}`);
        try {
          session.process.stdin?.write('echo "Terminal ready"\n');
        } catch (error) {
          console.error(`❌ Error initializing ${session.type} session:`, error);
        }
      }
    }, 800);
  }

  sendToRenderer(sessionId: string, data: string): void {
    // Send data directly to the renderer for visual feedback
    const mainWindow = (global as any).mainWindow;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('shell-output', sessionId, data);
    }
  }

  cleanup(): void {
    for (const [sessionId, session] of this.sessions) {
      session.process.kill();
    }
    this.sessions.clear();
  }
}

class App {
  private mainWindow: BrowserWindow | null = null;
  private terminalManager = new TerminalManager();
  private agentAdapter = new AgentGUIAdapter();
  private windowStartTime = 0;

  async createWindow(): Promise<void> {
    this.windowStartTime = Date.now();
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: true,
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        preload: path.join(__dirname, 'preload.js'),
        // GPU-related preferences
        offscreen: false,
        backgroundThrottling: false,
        // Security preferences
        webSecurity: false, // Allow local file access
        allowRunningInsecureContent: true,
        // Enable access to Node.js modules in renderer
        nodeIntegrationInWorker: true
      },
      backgroundColor: '#1e1e1e', // Dark background
      show: true // Show immediately for debugging
    });
    
    // Store global reference for terminal manager
    (global as any).mainWindow = this.mainWindow;

    // Load the HTML file (check for test modes)
    const useTestMode = process.env.CLI_AGENT_TEST === 'true';
    const useAITestMode = process.argv.includes('--test-ai');
    
    let htmlFile: string;
    let htmlPath: string;
    let mode: string;
    
    if (useAITestMode) {
      htmlFile = 'test-ai-panel.html';
      htmlPath = path.join(__dirname, '..', '..', htmlFile);
      mode = 'AI TEST';
    } else if (useTestMode) {
      htmlFile = 'test-minimal.html';
      htmlPath = path.join(__dirname, `../renderer/${htmlFile}`);
      mode = 'TEST';
    } else {
      htmlFile = 'index.html';
      htmlPath = path.join(__dirname, `../renderer/${htmlFile}`);
      mode = 'NORMAL';
    }
    
    console.log('📄 Loading HTML file from:', htmlPath, `(${mode} MODE)`);
    
    try {
      await this.mainWindow.loadFile(htmlPath);
      console.log('✓ HTML file loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load HTML file:', error);
    }

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      console.log('📺 Window ready to show');
      this.mainWindow?.show();
      
      // Focus the window and open dev tools for debugging
      if (this.mainWindow) {
        this.mainWindow.focus();
        this.mainWindow.webContents.openDevTools();
        console.log('✓ Window shown, focused, and dev tools opened');
      }
    });
    
    // Debug window load events
    this.mainWindow.webContents.on('did-start-loading', () => {
      console.log('🔄 Window started loading');
    });
    
    this.mainWindow.webContents.on('did-finish-load', () => {
      console.log('✓ Window finished loading');
    });
    
    this.mainWindow.webContents.on('dom-ready', () => {
      console.log('✓ DOM ready');
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      console.log('📺 Main window closed');
      this.mainWindow = null;
    });
    
    // Log window close events for debugging
    this.mainWindow.on('close', (event) => {
      console.log('🚨 Window close event triggered');
      const uptime = Date.now() - this.windowStartTime;
      console.log(`⏱️  Window was open for ${uptime}ms`);
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Set up menu
    this.setupMenu();
  }

  private setupMenu(): void {
    const template: any[] = [
      {
        label: 'File',
        submenu: [
          {
            label: 'New Tab',
            accelerator: 'CmdOrCtrl+T',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-tab');
            }
          },
          {
            label: 'Close Tab',
            accelerator: 'CmdOrCtrl+W',
            click: () => {
              this.mainWindow?.webContents.send('menu-close-tab');
            }
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              app.quit();
            }
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Shell',
        submenu: [
          {
            label: 'New PowerShell Tab',
            accelerator: 'CmdOrCtrl+Shift+P',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-shell-tab', 'powershell');
            }
          },
          {
            label: 'New Command Prompt Tab',
            accelerator: 'CmdOrCtrl+Shift+C',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-shell-tab', 'cmd');
            }
          },
          {
            label: 'New WSL Tab',
            accelerator: 'CmdOrCtrl+Shift+W',
            click: () => {
              this.mainWindow?.webContents.send('menu-new-shell-tab', 'wsl');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  private setupIpcHandlers(): void {
    // Handle shell session creation
    ipcMain.handle('create-shell-session', async (event, type: string) => {
      try {
        console.log(`🔧 Creating shell session: ${type}`);
        const sessionId = this.terminalManager.createSession(type as any);
        const session = this.terminalManager.getSession(sessionId);
        
        // Set up data handlers for this session
        if (session) {
          console.log(`✓ Shell session created: ${sessionId}`);
          
          // Set up stdout handler with better encoding
          session.process.stdout?.setEncoding('utf8');
          session.process.stdout?.on('data', (data) => {
            const output = data.toString('utf8');
            console.log(`📤 Shell output [${sessionId}]:`, output.slice(0, 100) + (output.length > 100 ? '...' : ''));
            this.mainWindow?.webContents.send('shell-output', sessionId, output);
          });

          // Set up stderr handler with better encoding
          session.process.stderr?.setEncoding('utf8');
          session.process.stderr?.on('data', (data) => {
            const output = data.toString('utf8');
            console.log(`📤 Shell error [${sessionId}]:`, output.slice(0, 100) + (output.length > 100 ? '...' : ''));
            this.mainWindow?.webContents.send('shell-output', sessionId, output);
          });

          // Handle process exit
          session.process.on('exit', (code) => {
            console.log(`🚪 Shell process exited [${sessionId}]: code ${code}`);
            this.mainWindow?.webContents.send('shell-exit', sessionId, code);
          });
          
          // Handle process errors
          session.process.on('error', (error) => {
            console.error(`❌ Shell process error [${sessionId}]:`, error);
            this.mainWindow?.webContents.send('shell-output', sessionId, `\r\nProcess error: ${error.message}\r\n`);
          });
          
          // Initialize shell session
          this.terminalManager.initializeShellSession(session);
          
          // Send initial welcome message
          setTimeout(() => {
            if (this.mainWindow && session) {
              const welcomeMsg = `${session.title} session ready\r\n`;
              console.log(`📤 Sending welcome message for ${sessionId}`);
              this.mainWindow.webContents.send('shell-output', sessionId, welcomeMsg);
              
              // Send a test prompt to verify the session is working
              setTimeout(() => {
                if (session.type === 'powershell') {
                  this.mainWindow?.webContents.send('shell-output', sessionId, 'PS > ');
                } else if (session.type === 'cmd') {
                  this.mainWindow?.webContents.send('shell-output', sessionId, 'C:\\> ');
                } else {
                  this.mainWindow?.webContents.send('shell-output', sessionId, '$ ');
                }
              }, 500);
            }
          }, 800);
        }

        return { success: true, sessionId, title: session?.title };
      } catch (error) {
        console.error('❌ Failed to create shell session:', error);
        return { success: false, error: (error as Error).message };
      }
    });

    // Handle shell input
    ipcMain.handle('shell-input', async (event, sessionId: string, data: string) => {
      console.log(`📥 Shell input [${sessionId}]:`, JSON.stringify(data));
      const success = this.terminalManager.writeToSession(sessionId, data);
      console.log(`✓ Input sent to shell [${sessionId}]: ${success ? 'success' : 'failed'}`);
      return { success };
    });

    // Handle session cleanup
    ipcMain.handle('kill-shell-session', async (event, sessionId: string) => {
      const success = this.terminalManager.killSession(sessionId);
      return { success };
    });

    // Handle terminal resize
    ipcMain.handle('terminal-resize', async (event, sessionId: string, cols: number, rows: number) => {
      console.log(`📱 Resize terminal [${sessionId}]: ${cols}x${rows}`);
      const session = this.terminalManager.getSession(sessionId);
      if (session && session.process && !session.process.killed) {
        console.log(`Terminal ${sessionId} resized to ${cols}x${rows}`);
        // Just acknowledge the resize - Windows console doesn't need manual resize commands
        console.log(`Terminal ${sessionId} acknowledged resize to ${cols}x${rows}`);
        return { success: true };
      }
      return { success: false };
    });

    // Handle app close
    ipcMain.handle('close-app', async () => {
      app.quit();
    });

    // Agent-related handlers
    ipcMain.handle('agent-initialize', async (event, workingDirectory?: string) => {
      try {
        const success = await this.agentAdapter.initialize(workingDirectory);
        return { success };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('agent-message', async (event, message: string) => {
      return await this.agentAdapter.processMessage(message);
    });

    ipcMain.handle('agent-execute-actions', async (event, actionIds: string[]) => {
      return await this.agentAdapter.executeActions(actionIds);
    });

    ipcMain.handle('agent-analyze-project', async () => {
      return await this.agentAdapter.analyzeProject();
    });

    ipcMain.handle('agent-get-capabilities', async () => {
      return this.agentAdapter.getCapabilities();
    });

    ipcMain.handle('agent-change-directory', async (event, newPath: string) => {
      const success = await this.agentAdapter.changeDirectory(newPath);
      return { success };
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Electron app...');
    
    // Add comprehensive error handling
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception in main process:', error);
      console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace available');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection:', reason);
      console.error('Promise:', promise);
    });
    
    // Handle GPU process crashes with recovery
    app.on('gpu-process-crashed', (event, killed) => {
      console.log('⚠️  GPU process crashed, killed:', killed);
      console.log('🔧 Attempting to continue with software rendering...');
      // The app should continue running with software rendering
    });

    // Handle renderer process crashes
    app.on('renderer-process-crashed', (event, webContents, killed) => {
      console.log('❌ Renderer process crashed, killed:', killed);
      // Attempt to reload the window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        console.log('🔄 Attempting to reload window...');
        this.mainWindow.reload();
      }
    });

    // Handle child process failures with detailed logging
    app.on('child-process-gone', (event, details) => {
      if (details.type === 'GPU') {
        console.log('📊 GPU process ended:', {
          reason: details.reason,
          exitCode: details.exitCode,
          serviceName: details.serviceName
        });
        console.log('✓ Continuing with software rendering - this is normal on Windows');
      } else {
        console.log('⚠️  Child process gone:', details);
      }
    });

    // Suppress GPU-related warnings in console
    process.on('warning', (warning) => {
      // Filter out GPU-related warnings that are harmless
      if (warning.message && warning.message.includes('gpu-process-crashed')) {
        return; // Suppress GPU crash warnings
      }
      console.warn('Warning:', warning.message);
    });

    // Disable hardware acceleration if needed (can be toggled)
    // app.disableHardwareAcceleration();

    // Handle app events
    app.whenReady().then(async () => {
      try {
        console.log('✓ App is ready, setting up handlers...');
        this.setupIpcHandlers();
        console.log('✓ IPC handlers set up');
        await this.createWindow();
        console.log('✓ Window created successfully');
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
        console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace available');
      }
    }).catch(error => {
      console.error('❌ Error in app.whenReady():', error);
    });

    app.on('window-all-closed', () => {
      console.log('📺 All windows closed');
      try {
        this.terminalManager.cleanup();
        if (process.platform !== 'darwin') {
          console.log('🚪 Quitting app...');
          app.quit();
        }
      } catch (error) {
        console.error('❌ Error during window-all-closed:', error);
      }
    });

    app.on('activate', async () => {
      try {
        console.log('🔄 App activated');
        if (BrowserWindow.getAllWindows().length === 0) {
          await this.createWindow();
        }
      } catch (error) {
        console.error('❌ Error during app activation:', error);
      }
    });

    app.on('before-quit', () => {
      try {
        console.log('📦 App is about to quit, cleaning up...');
        this.terminalManager.cleanup();
        this.agentAdapter.cleanup();
      } catch (error) {
        console.error('❌ Error during cleanup:', error);
      }
    });
  }
}

// Initialize the app
const appInstance = new App();
appInstance.initialize().catch(console.error);
