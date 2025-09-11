import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';
import { AgentGUIAdapter } from './agent-adapter';

interface ShellSession {
  id: string;
  type: 'powershell' | 'cmd' | 'wsl' | 'bash';
  process: ChildProcess;
  title: string;
}

class TerminalManager {
  private sessions: Map<string, ShellSession> = new Map();
  private sessionCounter = 0;

  createSession(type: 'powershell' | 'cmd' | 'wsl' | 'bash'): string {
    const sessionId = `session-${++this.sessionCounter}`;
    
    let shellCommand: string;
    let shellArgs: string[] = [];
    let title: string;

    switch (type) {
      case 'powershell':
        shellCommand = 'powershell.exe';
        shellArgs = ['-NoLogo'];
        title = 'PowerShell';
        break;
      case 'cmd':
        shellCommand = 'cmd.exe';
        title = 'Command Prompt';
        break;
      case 'wsl':
        shellCommand = 'wsl.exe';
        title = 'WSL';
        break;
      case 'bash':
        shellCommand = process.platform === 'win32' ? 'bash.exe' : 'bash';
        title = 'Bash';
        break;
      default:
        throw new Error(`Unsupported shell type: ${type}`);
    }

    try {
      const childProcess = spawn(shellCommand, shellArgs, {
        cwd: os.homedir(),
        env: process.env,
        shell: false
      });

      const session: ShellSession = {
        id: sessionId,
        type,
        process: childProcess,
        title
      };

      this.sessions.set(sessionId, session);

      // Handle process cleanup
      childProcess.on('exit', () => {
        this.sessions.delete(sessionId);
      });

      return sessionId;
    } catch (error) {
      throw new Error(`Failed to create ${type} session: ${error}`);
    }
  }

  getSession(sessionId: string): ShellSession | undefined {
    return this.sessions.get(sessionId);
  }

  writeToSession(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId);
    if (session && session.process.stdin) {
      session.process.stdin.write(data);
      return true;
    }
    return false;
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

  async createWindow(): Promise<void> {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      frame: true,
      titleBarStyle: 'default',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      backgroundColor: '#1e1e1e', // Dark background
      show: false // Don't show until ready
    });

    // Load the HTML file
    const htmlPath = path.join(__dirname, '../renderer/index.html');
    await this.mainWindow.loadFile(htmlPath);

    // Show window when ready to prevent visual flash
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      
      // Focus the window
      if (this.mainWindow) {
        this.mainWindow.focus();
      }
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
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
        const sessionId = this.terminalManager.createSession(type as any);
        const session = this.terminalManager.getSession(sessionId);
        
        // Set up data handlers for this session
        if (session) {
          session.process.stdout?.on('data', (data) => {
            this.mainWindow?.webContents.send('shell-output', sessionId, data.toString());
          });

          session.process.stderr?.on('data', (data) => {
            this.mainWindow?.webContents.send('shell-output', sessionId, data.toString());
          });

          session.process.on('exit', (code) => {
            this.mainWindow?.webContents.send('shell-exit', sessionId, code);
          });
        }

        return { success: true, sessionId, title: session?.title };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    // Handle shell input
    ipcMain.handle('shell-input', async (event, sessionId: string, data: string) => {
      const success = this.terminalManager.writeToSession(sessionId, data);
      return { success };
    });

    // Handle session cleanup
    ipcMain.handle('kill-shell-session', async (event, sessionId: string) => {
      const success = this.terminalManager.killSession(sessionId);
      return { success };
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
    // Handle app events
    app.whenReady().then(() => {
      this.setupIpcHandlers();
      this.createWindow();
    });

    app.on('window-all-closed', () => {
      this.terminalManager.cleanup();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', async () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        await this.createWindow();
      }
    });

    app.on('before-quit', () => {
      this.terminalManager.cleanup();
      this.agentAdapter.cleanup();
    });
  }
}

// Initialize the app
const appInstance = new App();
appInstance.initialize().catch(console.error);
